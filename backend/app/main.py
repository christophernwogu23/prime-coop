from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import connect_to_mongo, close_mongo_connection
from .routes import auth, dashboard, users, loans, savings, dividends, attendance, reports

app = FastAPI(title="Prime Coop API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db_client():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(users.router)
app.include_router(loans.router)
app.include_router(savings.router)
app.include_router(dividends.router)
app.include_router(attendance.router)
app.include_router(reports.router)

@app.get("/")
async def root():
    return {"message": "Prime Coop API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}