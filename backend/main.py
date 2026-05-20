from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tempfile
import os
from .utils import process_pdf
from .firebase_init import init_firebase, send_alert

app = FastAPI(title="FinSecure Scanner API")


class AdminLoginRequest(BaseModel):
    adminId: str
    password: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_firebase()



@app.get("/")
def read_root():
    return {"status": "ok", "message": "FinSecure Scanner API", "docs": "/docs"}


@app.post("/admin-login")
def admin_login(payload: AdminLoginRequest):
    expected_admin_id = os.environ.get("ADMIN_ID", "ADMIN-001")
    expected_password = os.environ.get("ADMIN_PASSWORD", "admin123")

    if payload.adminId.strip() != expected_admin_id or payload.password != expected_password:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

    return {"status": "ok", "role": "admin"}


@app.post("/scan")
async def scan(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    try:
        content = await file.read()
        tmp.write(content)
        tmp.flush()
        tmp.close()

        result = process_pdf(tmp.name)

        # send an alert to Firebase if configured
        try:
            send_alert(result)
        except Exception:
            # don't fail the request if notifications fail
            pass

        return result
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
