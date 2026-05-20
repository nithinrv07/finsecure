FinSecure Backend
=================

Quickstart
---------

1. Create a virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r backend/requirements.txt
```

2. Set environment variables (optional but recommended):

- `AWS_REGION` — AWS region for Textract calls (e.g. us-east-1)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — if not using IAM role
- `FIREBASE_SERVICE_ACCOUNT` — path to Firebase service account JSON to enable alerts
- Firebase Email/Password Auth must be enabled for admin sign-in in the React app

3. Run the API:

```bash
uvicorn backend.main:app --reload
```

Endpoints
---------

- `POST /scan` — multipart form file field named `file`. Accepts PDF and returns a JSON object with `score`, `flags`, `tamper_signals`, `avg_ocr_confidence`, and `text` (truncated).

Admin access
------------

- The admin login form now uses Firebase Authentication with email/password.
- Create the admin user in Firebase Auth and use that email/password in the app.

Notes
-----

- This implementation uses AWS Textract when available; if not configured it falls back to PyMuPDF text extraction.
- Image tamper checks are heuristic-based using OpenCV and intended as early signals, not definitive proof.
