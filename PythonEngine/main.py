import pandas as pd
import yfinance as yf
import requests
import asyncio
import os
import datetime
import traceback
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, List
import uvicorn

app = FastAPI()
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5044")

CSV_FILE = "watch_list.csv"
ANALYSIS_STATE = {}

if not os.path.exists(CSV_FILE):
    df = pd.DataFrame(columns=["symbol", "strategy_id", "execution_id", "timeframe", "analysis_duration", "predict_sl_and_target", "date_added"])
    df.to_csv(CSV_FILE, index=False)

class SymbolRequest(BaseModel):
    symbol: str
    strategy_id: str
    execution_id: str
    timeframe: str
    analysis_duration: int = 60
    predict_sl_and_target: bool = False

class StrategyRequest(BaseModel):
    strategy_id: str

EXPECTED_COLUMNS = ["symbol", "strategy_id", "execution_id", "timeframe", "analysis_duration", "predict_sl_and_target", "date_added"]

@app.post("/add_symbol")
def add_symbol(req: SymbolRequest):
    if not os.path.exists(CSV_FILE):
        df = pd.DataFrame(columns=EXPECTED_COLUMNS)
    else:
        df = pd.read_csv(CSV_FILE)
        # Ensure all columns exist
        for col in EXPECTED_COLUMNS:
            if col not in df.columns:
                df[col] = ""
        
    if not ((df["symbol"].astype(str) == str(req.symbol)) & (df["strategy_id"].astype(str) == str(req.strategy_id))).any():
        new_row = {
            "symbol": req.symbol,
            "strategy_id": req.strategy_id,
            "execution_id": req.execution_id,
            "timeframe": req.timeframe,
            "analysis_duration": req.analysis_duration,
            "predict_sl_and_target": req.predict_sl_and_target,
            "date_added": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        df.to_csv(CSV_FILE, index=False)
        
        log_msg = f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Strategy: {req.strategy_id} | Added {req.symbol} to python monitor (ExecId: {req.execution_id}).\n"
        with open("analysis_logs.txt", "a") as f:
            f.write(log_msg)
            
    return {"status": "success"}

@app.post("/remove_strategy")
def remove_strategy(req: StrategyRequest):
    if os.path.exists(CSV_FILE):
        df = pd.read_csv(CSV_FILE)
        if "strategy_id" in df.columns:
            df = df[df["strategy_id"].astype(str) != str(req.strategy_id)]
            df.to_csv(CSV_FILE, index=False)
    return {"status": "success"}

async def check_opportunities():
    while True:
        try:
            df = pd.read_csv(CSV_FILE)
            for col in EXPECTED_COLUMNS:
                if col not in df.columns:
                    df[col] = ""
            indices_to_remove = []
            for index, row in df.iterrows():
                symbol = row["symbol"]
                fetch_symbol = symbol
                if not ("." in symbol or "-" in symbol or "=" in symbol):
                    fetch_symbol = f"{symbol}.NS"
                
                try:
                    period = "1mo"
                    tf = row["timeframe"]
                    if tf == "1m":
                        period = "5d"
                    elif tf == "1d":
                        period = "3mo"

                    try:
                        data = pd.DataFrame()
                        for attempt in range(3):
                            data = yf.download(fetch_symbol, period=period, interval=row["timeframe"], progress=False)
                            if len(data) == 0 and fetch_symbol.endswith(".NS"):
                                fetch_symbol = symbol
                                data = yf.download(fetch_symbol, period=period, interval=row["timeframe"], progress=False)

                            if len(data) >= 20: 
                                break
                            await asyncio.sleep(2)
                    except Exception as fetch_err:
                        log_msg = f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Strategy: {row['strategy_id']} | Symbol: {symbol} | YFinance Fetch Error: {fetch_err}\n"
                        with open("analysis_logs.txt", "a") as f: f.write(log_msg)
                        continue

                    if len(data) < 20: 
                        log_msg = f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Strategy: {row['strategy_id']} | Symbol: {symbol} | Error: YFinance API returned blank/insufficient data ({len(data)} pts after retries)\n"
                        with open("analysis_logs.txt", "a") as f: f.write(log_msg)
                        continue
                    
                    if isinstance(data.columns, pd.MultiIndex):
                        data.columns = data.columns.droplevel(1)
                    
                    data['EMA20'] = data['Close'].ewm(span=20, adjust=False).mean()
                    data['Support'] = data['Low'].rolling(window=20).min()
                    data['Resistance'] = data['High'].rolling(window=20).max()
                    data['VolAvg'] = data['Volume'].rolling(window=20).mean()
                    
                    latest = data.iloc[-1]
                    prev = data.iloc[-2]
                    
                    try:
                        current_live_price = float(yf.Ticker(fetch_symbol).fast_info.last_price)
                    except Exception:
                        current_live_price = float(latest['Close'])
                        
                    price = current_live_price
                    ema20 = float(latest['EMA20'])
                    resistance = float(prev['Resistance'])
                    support = float(prev['Support'])
                    volume = float(latest['Volume'])
                    vol_avg = float(prev['VolAvg'])
                    
                    # is_opportunity = False
                    # reason = ""
                    
                    # if price <= ema20:
                    #     reason = "Below EMA20"
                    # elif volume <= vol_avg * 1.5:
                    #     reason = "Low Volume"
                    # elif price < resistance * 0.99:
                    #     reason = "Below Resistance"
                    # else:
                    #     is_opportunity = True
                    #     reason = "Breakout!"

                    is_opportunity = False
                    reason = ""

                    # ✅ NEW: EMA cross check (prevents late entries)
                    ema_cross = price > ema20 and prev['Close'] <= prev['EMA20']

                    # ✅ NEW: Strong breakout condition (no early entry)
                    valid_breakout = price > resistance   # CHANGED (removed 0.99 buffer)

                    # ✅ NEW: Volume confirmation (keep same but cleaner)
                    volume_spike = volume > vol_avg * 1.5

                    # ✅ OPTIONAL BUT IMPORTANT: Trend filter (avoid downtrend trades)
                    ema_trend = ema20 > data.iloc[-2]['EMA20']   # EMA rising

                    # 🔴 Decision logic
                    if not ema_cross:
                        reason = "No EMA cross (late or weak entry)"   # NEW
                    elif not ema_trend:
                        reason = "EMA not trending up"                # NEW
                    elif not volume_spike:
                        reason = "Low Volume"
                    elif not valid_breakout:
                        reason = "No breakout"
                    else:
                        is_opportunity = True
                        reason = "Strong Breakout + EMA Cross"        # UPDATED
                            
                    state_key = f"{row['strategy_id']}_{symbol}"
                    current_state = f"{is_opportunity}_{reason}"
                    now_time = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    start_time_val = row.get('date_added')
                    if pd.isna(start_time_val) or str(start_time_val).strip() == "":
                         start_time_val = now_time
                    
                    log_msg = f"[Start: {start_time_val}] [Last: {now_time}] Strategy: {row['strategy_id']} | Symbol: {symbol} | Price: {price:.2f} | EMA20: {ema20:.2f} | Support: {support:.2f} | Resistance: {resistance:.2f} | Vol: {volume:.0f} | VolAvg: {vol_avg:.2f} | Opportunity: {is_opportunity} | Reason: {reason}\n"
                    
                    # Always update the log file with latest timestamp and metrics
                    logs = []
                    if os.path.exists("analysis_logs.txt"):
                        with open("analysis_logs.txt", "r") as f:
                            logs = f.readlines()
                    
                    found_idx = -1
                    search_pattern = f"Strategy: {row['strategy_id']} | Symbol: {symbol} |"
                    for i, line in enumerate(logs):
                        if search_pattern in line:
                            # If it's the SAME reason, we replace to update the 'Last' timestamp and Price
                            if f"Reason: {reason}" in line:
                                found_idx = i
                                break
                    
                   #  if found_idx >= 0:
                   #     logs[found_idx] = log_msg
                   # else:
                    logs.append(log_msg)
                    # print(log_msg)
                    
                    # Keep file manageable
                    with open("analysis_logs.txt", "w") as f:
                        f.writelines(logs[-1000:])
                        
                    ANALYSIS_STATE[state_key] = current_state
                            
                    if is_opportunity:
                        payload = {
                            "strategyId": row["strategy_id"],
                            "executionId": row["execution_id"],
                            "symbol": row["symbol"].replace(".NS", ""),
                            "price": price,
                            "volume": volume
                        }
                        
                        # Add predicted SL and Target dynamically if requested
                        predict_sl_and_tgt_val = row.get("predict_sl_and_target", False)
                        if predict_sl_and_tgt_val == True or str(predict_sl_and_tgt_val).lower() == 'true':
                            payload["targetPrice"] = resistance
                            payload["stopLossPrice"] = support

                        try:
                            resp = requests.post(f"{BACKEND_URL.rstrip('/')}/api/TradingWebhook/opportunity", json=payload)
                        except Exception as e:
                            print(f"Error calling webhook: {e}")
                    
                    # Check for expiration
                    date_added_val = row.get("date_added")
                    if pd.isna(date_added_val) or str(date_added_val).strip() == "":
                        date_added_val = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    
                    date_added = datetime.datetime.strptime(str(date_added_val), "%Y-%m-%d %H:%M:%S")
                    dur_val = row.get("analysis_duration")
                    try:
                        duration_limit = int(float(dur_val)) if not pd.isna(dur_val) and str(dur_val).strip() != "" else 60
                    except:
                        duration_limit = 60
                    
                    if (datetime.datetime.now() - date_added).total_seconds() > (duration_limit * 60):
                        print(f"Watch duration expired for {symbol} (ExecId: {row['execution_id']}) after {duration_limit}m")
                        try:
                            # Notify Backend
                            requests.post(f"{BACKEND_URL.rstrip('/')}/api/TradingWebhook/expired", json={"executionId": str(row["execution_id"])})
                            # Remove from list
                            indices_to_remove.append(index)
                        except Exception as e:
                            print(f"Error notifying expiration for {symbol}: {e}")
                except Exception as ex:
                    print(f"Error processing symbol {symbol}: {ex}")
            
            if indices_to_remove:
                df = df.drop(indices_to_remove)
                df.to_csv(CSV_FILE, index=False)
        except Exception as e:
            traceback.print_exc()
            print(f"Error in background task: {e}")
        
        await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(check_opportunities())

@app.get("/logs")
def get_logs(strategy_id: Optional[str] = None):
    if not os.path.exists("analysis_logs.txt"):
        return {"logs": "No Python analysis logs available yet."}
    with open("analysis_logs.txt", "r") as f:
        all_lines: List[str] = f.readlines()
    if strategy_id:
        all_lines = [l for l in all_lines if f"Strategy: {strategy_id} " in l]
    result = all_lines[-200:] if len(all_lines) > 200 else all_lines
    return {"logs": "".join(result)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
