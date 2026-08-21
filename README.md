# EzFinanz — Personal Loan Management System

EzFinanz is a full-stack loan application and approval platform designed to simulate a real digital lending workflow. It walks a customer from signup to application submission, eligibility review, EMI selection, declaration, selfie verification, and final admin approval or disbursement. The app is built as a practical demo for recruiters, evaluators, and technical reviewers to understand the product flow, backend logic, and UI implementation.

This project demonstrates end-to-end application architecture: secure authentication, role-based access control, workflow state management, file upload handling, financial calculations, and admin review operations.

## Recruiter-facing summary

- Full-stack fintech demo with a customer onboarding flow and admin approval workflow
- Built using FastAPI + React with SQLAlchemy, SQLite for local fallback, and Supabase PostgreSQL for deployment
- Includes JWT authentication, OTP-based phone/email verification, Google sign-in support, and an admin dashboard
- Implements real business logic for loan eligibility, EMI calculation, fees, charges, and IRR estimation
- Designed to feel like a production-ready MVP for a lending product

## Business problem it solves

The app recreates the core user journey of a digital lending platform:

- A customer creates an account and verifies their contact information
- The platform collects KYC details and supporting documents
- The system evaluates if the customer is eligible for a loan based on income, credit quality, and debt obligations
- The customer chooses EMI terms and bank account details
- A declaration and selfie are submitted for compliance checks
- An admin reviews the application, approves or rejects the selfie, and can confirm disbursement

This is the kind of workflow a fintech company or lending product team would use to onboard customers and manage risk decisions.

## Key product features

### Customer experience

- Email sign-up and password login
- Phone number sign-up and OTP verification
- Optional Google login flow
- Multi-step loan application flow with persistent state
- KYC details collection with optional ID document upload
- Eligibility engine based on income, credit score, DTI ratio, and affordability
- EMI quote generation and confirmation using lender rate assumptions
- Bank account capture for repayment/disbursement
- Declaration/acknowledgement before final submit
- Selfie upload with admin review step
- Private Supabase Storage support for KYC documents and selfies

### Admin experience

- Secure admin login using seeded admin account
- Dashboard listing all applications with metadata and lifecycle state
- Detailed application review screen showing KYC, eligibility, EMI, bank, declaration, and selfie information
- Selfie approval/rejection workflow with reason handling
- Final loan disbursement action once an application is approved

### Financial logic

- Rating tiers mapped to annualized lender rates
- DTI-based affordability checks
- EMI computation using standard amortization formulas
- Eligibility rejection when credit score or debt burden is too high
- Processing fee, GST, other charges, net disbursement, total repayment, and IRR calculation

## Tech stack

### Backend

- FastAPI
- SQLAlchemy ORM
- SQLite (default database)
- Pydantic request/response validation
- python-jose for JWT
- passlib + bcrypt for password hashing
- python-multipart for file uploads
- Google OAuth verification with google-auth
- psycopg for PostgreSQL connectivity through the Supabase transaction pooler

### Frontend

- React 19
- Vite
- React Router
- Axios for API requests
- Tailwind CSS for styling
- @react-oauth/google for Google sign-in

### Dev tooling

- Uvicorn for backend serving
- Vite dev server for frontend
- Python virtual environment managed locally

## Architecture overview

The app is split into two major layers:

1. Backend API layer
   - Handles all business logic
   - Persists loan application state and user data
   - Enforces role-based authorization
   - Performs all financial and workflow decisions

2. Frontend app layer
   - Provides customer and admin screens
   - Tracks local auth state
   - Calls backend APIs using JWT bearer tokens
   - Implements the multi-step guided application journey

The backend and frontend are intentionally easy to run locally while supporting hosted services in deployment. In local development, OTPs use the authenticated inbox and uploads fall back to `backend/uploads/`. In deployment, OTP delivery can use SMTP/Twilio and sensitive documents can use a private Supabase Storage bucket.

Verification & security (Important recruiter/demo notes)
-------------------------------------------------------
For this submission the identity verification flow has been implemented as a mandatory, separate step in the loan application. Please note the following key behaviors (these are intentionally strict to reflect production expectations):

- Mandatory identity verification: Both email and phone verification are required before a customer can proceed to the loan application steps. These are stored independently on the User model as `email_verified` and `phone_verified`.

- OTP security and throttling:
  - OTPs are 6-digit numeric codes, generated server-side and hashed (SHA-256) in the database.
  - TTL: 10 minutes from issuance.
  - Single-use: an OTP is consumed on success, expiry, or after too many failed attempts.
  - Cooldown: 60 seconds between OTP requests for the same user and verification channel (email or phone). Repeated requests within cooldown return HTTP 429 with a Retry-After header.
  - Request cap: maximum 5 OTP requests per verification channel per user within a rolling 1-hour window (returns HTTP 429 when exceeded).
  - Verification attempts: maximum 5 incorrect attempts per OTP; upon the 5th incorrect attempt the OTP is invalidated and the user must request a new code.

- DEV_MODE behavior:
  - When `EZFINANZ_DEV_MODE=true` the project exposes an authenticated inbox endpoint (`GET /api/verification/inbox`) that shows the latest unconsumed OTP messages for the authenticated user. This is strictly for development/demonstration — OTPs are NOT exposed in production when DEV_MODE=false.
  - DEV_MODE does NOT bypass or weaken server-side throttling, expiry, or attempt limits.

- Delivery:
  - The code supports SMTP for email and Twilio for SMS. When those are not configured (or Twilio trial limitations apply), DEV_MODE inbox is used for demonstration only.

Demo & run instructions (quick)
------------------------------
1. Backend (from `backend/`):
   - Create and activate a virtualenv, install dependencies:
     - python -m venv venv
     - venv\Scripts\activate
     - pip install -r requirements.txt
   - Run the backend in development/demo mode (DEV inbox available):
     - set EZFINANZ_DEV_MODE=true
     - set any other env vars needed (SECRET_KEY, DATABASE_URL optional)
     - python -m uvicorn app.main:app --host 0.0.0.0 --port 8133
   - Health check: GET http://localhost:8133/api/health

2. Frontend (from `frontend/`):
   - npm install
  - npm run dev (open http://localhost:5173; the port is fixed for Google OAuth)
   - Or build for production (the built `dist/` is included in the submission ZIP so reviewers can open static assets):
     - npm run build
     - Serve `frontend/dist/` using a static file server if desired.

3. Demo flow to validate verification:
   - Sign up using email or phone (or Google). Regardless of signup method, the Verify Identity step requires BOTH email and phone verification before continuing.
   - Use the UI buttons to "Send Verification Code" (email) and "Send OTP" (phone). In DEV_MODE you will see OTPs in the in-app inbox.
   - Attempting to jump ahead to KYC/loan steps without both `email_verified` and `phone_verified` will be rejected by the backend (HTTP 403).

What's included for reviewers
----------------------------
- Full source code for backend and frontend
- DEPLOY.md with Render/Vercel deployment steps
- `backend/migrate_sqlite_to_postgres.py` for non-destructive SQLite to PostgreSQL migration
- `backend/tests/test_verification.py` for OTP and identity-verification coverage
- `backend/tools/demo_smoke.py` for a lightweight API smoke workflow
- frontend/dist/ (production build) included in the submission ZIP so reviewers can open the static frontend without running npm (optional)

Notes
-----
- No production credentials (Twilio, SMTP, Google client secrets) are committed in the repository. If you configure those providers, set the appropriate environment variables — do not add secrets to committed files.
- Automated tests cover mandatory identity verification, OTP inbox usage, incorrect-attempt lockout, and KYC access control.

If anything else should be clarified in the README for the recruiter's review, tell me which section to expand and I'll add it.


## Project structure

```text
ezfinanz/
├── README.md
├── backend/
│   ├── .env.example
│   ├── Procfile
│   ├── requirements.txt
│   ├── seed.py
│   ├── migrate_sqlite_to_postgres.py
│   ├── tests/
│   │   └── test_verification.py
│   ├── tools/
│   │   └── demo_smoke.py
│   ├── uploads/
│   │   ├── kyc_docs/
│   │   └── selfies/
│   ├── venv/
│   └── app/
│       ├── __init__.py
│       ├── database.py
│       ├── main.py
│       ├── models.py
│       ├── schemas.py
│       ├── security.py
│       ├── storage.py
│       ├── routers/
│       │   ├── admin.py
│       │   ├── application.py
│       │   ├── auth.py
│       │   └── verification.py
│       └── utils/
│           ├── calculations.py
│           └── otp.py
├── frontend/
│   ├── .env.example
│   ├── .gitignore
│   ├── .oxlintrc.json
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── vite.config.js
│   ├── public/
│   └── src/
│       ├── App.jsx
│       ├── api/
│       │   └── client.js
│       ├── components/
│       │   ├── GoogleSignInButton.jsx
│       │   ├── Logo.jsx
│       │   ├── ProtectedRoute.jsx
│       │   ├── Stepper.jsx
│       │   └── ui.jsx
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── main.jsx
│       ├── pages/
│       │   ├── AdminApplicationDetail.jsx
│       │   ├── AdminDashboard.jsx
│       │   ├── CustomerApp.jsx
│       │   ├── Login.jsx
│       │   └── steps/
│       │       ├── BankStep.jsx
│       │       ├── DeclarationStep.jsx
│       │       ├── EligibilityStep.jsx
│       │       ├── EmiStep.jsx
│       │       ├── KycStep.jsx
│       │       ├── SelfieStep.jsx
│       │       ├── StatusStep.jsx
│       │       └── VerifyStep.jsx
│       └── utils/
│           └── validation.js
└── .gitignore
```

## Backend data model and workflow details

The backend uses SQLAlchemy models defined in `backend/app/models.py`.

### Core entities

- `User`
  - Stores full name, email, phone, password hash, auth provider, role, and verification status
  - Roles: `customer` and `admin`
  - Auth providers: `email`, `phone`, and `google`

- `OTPCode`
  - Stores a SHA-256 code hash, expiry, destination, failed-attempt count, and development message content
  - Used for email and phone verification flow

- `LoanApplication`
  - Top-level application container
  - Tracks current application stage and overall status
  - Linked to KYC, eligibility, EMI, bank, declaration, and selfie data

- `KYCDetail`
  - Stores personal data and ID information
  - Stores a private Supabase Storage object key when hosted Storage is configured, or a local path in development fallback mode

- `EligibilityCheck`
  - Stores annual income, requested amount, credit score, debt burden, employer info, DTI ratio, result, and maximum eligible amount

- `EMISelection`
  - Stores chosen loan amount, tenure, rate, charges, disbursement, EMI, total repayment, and calculated IRR

- `BankAccount`
  - Stores account holder name, account number, IFSC, and bank name

- `Declaration`
  - Tracks whether the applicant accepted the final declaration

- `Selfie`
  - Stores a private Storage object key or local fallback path, status, rejection reason, reviewer ID, and review timestamp

### Application stages

The application lifecycle is implemented with enums in `ApplicationStage`:

- `Account Verification`
- `KYC`
- `Eligibility`
- `EMI Selection`
- `Bank Details`
- `Declaration`
- `Selfie Pending`
- `Waiting for Admin Review`
- `Approved`
- `Rejected`
- `Disbursed`

## Auth and security model

### JWT authentication

The security layer is defined in `backend/app/security.py`.

- JWT secret is read from `JWT_SECRET` environment variable
- Default fallback is a demo secret for local development
- Access token lifetime is 24 hours
- `require_admin` and `require_customer` are used to enforce authorization on protected routes

### Password hashing

- Uses `bcrypt` via `passlib` for password hashing
- Email-based accounts use password login
- Phone-based accounts are designed for OTP-only login

### Google login

- Optional Google OAuth is implemented in `backend/app/routers/auth.py`
- Server validates the Google credential token against configured client ID
- A user record is created or updated automatically if the email is valid
- The frontend uses `@react-oauth/google` and is pinned to `http://localhost:5173` in development so the Google Cloud authorized origin stays stable
- Production requires the deployed frontend domain to be added to Google Cloud authorized JavaScript origins

## Verification flow

The OTP verification flow is implemented in `backend/app/routers/verification.py` and `backend/app/utils/otp.py`.

### OTP behavior

- 6-digit numeric OTP is generated
- Expiration is 10 minutes by default
- Messages can be sent using SMTP if configured
- If SMTP is not configured, the app uses an in-app inbox flow for simulation

### Development mode

Set the following env variable in the backend to make the demo reviewer-friendly:

```bash
EZFINANZ_DEV_MODE=true
```

When enabled:

- OTP codes are stored in the authenticated in-app inbox
- The frontend shows OTPs in the verification dashboard for easier testing
- OTP codes are not returned in API responses
- This is ideal for a demo or assignment environment

## Eligibility and loan decision logic

Loan decisioning is implemented in `backend/app/utils/calculations.py`.

### Rate tiers

The app uses a simulated pricing model inspired by credit tiering:

- 750+ — Excellent — 10.5% p.a.
- 700+ — Very Good — 12.0% p.a.
- 650+ — Good — 14.5% p.a.
- 600+ — Fair — 17.5% p.a.
- 550+ — Below Average — 21.0% p.a.
- Below 550 — Not eligible

### Key affordability rules

- Maximum DTI ratio: 0.55
- Maximum EMI-to-income ratio: 0.50
- Credit score below 550 results in automatic rejection
- If the debt burden is too high, the application is rejected even before EMI calculation
- Eligibility result can be:
  - `Eligible`
  - `Partially Eligible`
  - `Not Eligible`

### EMI and IRR details

The app calculates:

- EMI using standard amortization
- Processing fee equal to 2% of loan amount
- GST on fee at 18%
- Flat other charges of ₹236
- Net disbursement = loan amount - fees - other charges
- Total repayment and total interest
- Annualized IRR using a monthly-rate bisection solver

This gives the app a realistic lending-demo feel while remaining lightweight and easy to understand.

## Frontend user flow

The front-end is organized around a guided application process in `frontend/src/pages/CustomerApp.jsx`.

### Step sequence

1. Verify identity
   - Email and/or phone verification using OTP
2. KYC details
   - Personal info, DOB, gender, address, ID type/number, optional document upload
3. Eligibility check
   - Annual income, credit score, debt burden, employer, designation
4. EMI terms
   - Loan amount and tenure selection
5. Bank account
   - Disbursement account details
6. Declaration
   - Customer acceptance of terms and final confirmation
7. Selfie verification
   - Image upload or camera capture
8. Status / review
   - Final application status and admin outcomes

The stepper UI keeps the user moving through a structured process and persists the last view in session storage.

## Admin workflow

The admin dashboard is in `frontend/src/pages/AdminDashboard.jsx` and details are displayed in `frontend/src/pages/AdminApplicationDetail.jsx`.

Admin actions include:

- Viewing all applications in a list
- Reading customer and application metadata
- Reviewing KYC, eligibility, EMI, bank, declaration, and selfie data
- Approving or rejecting the selfie with an optional reason
- Final disbursement confirmation after approval

The backend routes include:

- `GET /api/admin/applications`
- `GET /api/admin/applications/{application_id}`
- `GET /api/admin/applications/{application_id}/selfie-image`
- `POST /api/admin/applications/{application_id}/selfie/review`
- `POST /api/admin/applications/{application_id}/disburse`

## Environment configuration

### Backend example file

`backend/.env.example` includes:

```bash
JWT_SECRET=change-this-to-a-long-random-string
EZFINANZ_DEV_MODE=false
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
SUPABASE_STORAGE_BUCKET=ezfinanz-private
# Optional SMTP for real email OTP delivery
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=you@gmail.com
# SMTP_PASSWORD=your-app-password
# SMTP_FROM=you@gmail.com
```

### Frontend example file

`frontend/.env.example` includes:

```bash
VITE_API_BASE_URL=https://your-backend-url.onrender.com/api
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

### Database and storage configuration

The app uses SQLAlchemy for both local SQLite and hosted PostgreSQL. If `DATABASE_URL` is unset, it falls back to:

```text
backend/ezfinanz.db
```

For Supabase deployment, set `DATABASE_URL` to the transaction pooler URI. The application disables prepared statements for PgBouncer compatibility. The migrated PostgreSQL schema is not recreated automatically at every startup; set `EZFINANZ_SCHEMA_INIT=true` only when explicitly initializing a new schema.

KYC documents and selfies use a private Supabase Storage bucket when `SUPABASE_SERVICE_ROLE_KEY` is configured. The service-role key must exist only on the backend. Without it, local development stores files under `backend/uploads/`.

## Running the application locally

### 1) Backend start

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload --port 8133
```

### 2) Frontend start

```bash
cd frontend
npm install
npm run dev
```

### 3) Access the app

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8133`
- Swagger docs: `http://localhost:8133/docs`
- Health check: `http://localhost:8133/api/health`

### 4) Run the tests

From `backend/`, use an isolated SQLite database so local or hosted data is not changed:

```powershell
$env:DATABASE_URL="sqlite:///C:/temp/ezfinanz-test.db"
pytest -q
```

The checked-in tests cover both-channel identity verification, OTP inbox usage, failed-attempt invalidation, throttling-related access behavior, and KYC authorization.

## Seeded admin account

A default admin user is created by `backend/seed.py`:

- Email: `admin@ezfinanz.com`
- Password: `Admin@123`

This is for demo use only. In a real deployment, this should be replaced with proper secure admin provisioning and environment-based secrets.

## Demo workflow for reviewers

1. Launch the backend and frontend.
2. Create a new customer account either with email/password or by using the phone OTP option.
3. Verify your email/phone number.
4. Complete KYC details with optional ID document upload.
5. Submit income and credit data to check eligibility.
6. Select EMI terms and confirm the loan terms.
7. Add a bank account.
8. Accept the declaration.
9. Upload a selfie.
10. Log in as the admin and review the application.
11. Approve or reject the selfie and, if approved, disburse the loan.

## API routes overview

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `POST /api/auth/oauth/google`
- `GET /api/auth/me`

### Verification

- `POST /api/verification/request-otp`
- `POST /api/verification/verify-otp`
- `GET /api/verification/inbox`

### Application

- `GET /api/application/me`
- `POST /api/application/kyc`
- `POST /api/application/kyc/id-document`
- `POST /api/application/eligibility`
- `POST /api/application/emi/quote`
- `POST /api/application/emi/confirm`
- `POST /api/application/bank-account`
- `POST /api/application/declaration`
- `POST /api/application/selfie`

### Admin

- `GET /api/admin/applications`
- `GET /api/admin/applications/{application_id}`
- `GET /api/admin/applications/{application_id}/selfie-image`
- `POST /api/admin/applications/{application_id}/selfie/review`
- `POST /api/admin/applications/{application_id}/disburse`

## SQLite to Supabase migration

The repository includes `backend/migrate_sqlite_to_postgres.py` for moving existing local data to Supabase PostgreSQL. It copies users, applications, OTP records, KYC, eligibility, EMI, bank, declaration, selfie, and review data. The SQLite source is read-only during migration.

```powershell
$env:SOURCE_DATABASE_URL="sqlite:///C:/path/to/backend/ezfinanz.db"
$env:DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"
python migrate_sqlite_to_postgres.py
```

The migration is intentionally separate from application startup so a deployment cannot accidentally overwrite hosted data. Keep the original SQLite file as a backup until the hosted application has been verified.

## Interview discussion points

### Why this architecture?

- FastAPI gives typed request validation, dependency injection, automatic OpenAPI documentation, and a small API surface.
- SQLAlchemy keeps the domain model independent from the database engine, allowing local SQLite and hosted PostgreSQL without rewriting business logic.
- React owns the guided customer experience while the backend remains authoritative for identity verification, eligibility, financial calculations, and workflow transitions.
- The frontend uses a central Axios client for API calls and JWT attachment; authorization is still enforced by backend dependencies.

### Security decisions

- Passwords are hashed with bcrypt and never stored as plaintext.
- JWTs protect authenticated routes, with separate customer and admin authorization dependencies.
- Google ID tokens are verified server-side against the configured Google client ID.
- OTPs are generated server-side, hashed before persistence, time-limited, single-use, rate-limited, and invalidated after failed-attempt limits.
- Development OTPs are exposed only through an authenticated inbox and are never returned as a `dev_otp` API field.
- KYC documents and selfies use a private Storage bucket and are retrieved through authenticated backend routes; the Supabase service-role key is backend-only.

### Business rules demonstrated

- Both email and phone verification are mandatory before KYC.
- Credit score, DTI, income, affordability, and requested amount drive eligibility.
- EMI terms include interest, processing fee, GST, other charges, net disbursement, total repayment, and IRR.
- Admin review status and remarks are persisted and shown to the customer.
- Duplicate application records are resolved by preferring the reviewed application in the customer portal.

### Questions a reviewer can ask

- How would you replace the demo SQLite-to-PostgreSQL migration with Alembic migrations?
- How would you add audit logs for admin decisions and disbursements?
- How would you implement idempotency for payment/disbursement requests?
- How would you move from open demo CORS to an allowlist of deployed frontend origins?
- How would you add object-size/type validation, malware scanning, retention rules, and signed URLs for uploaded documents?
- How would you add background jobs for email/SMS delivery and retry handling?

## Production concerns and demo disclaimers

This project is intended for technical demonstration and local review. Certain aspects are intentionally simplified for clarity:

- CORS is open for local demo use
- OTP delivery is simulated and can be shown in-app
- SQLite remains available as a local fallback; deployed environments use Supabase PostgreSQL
- File uploads require a private Supabase Storage bucket in deployed environments because Render filesystems are ephemeral
- The default admin credentials are intentionally easy to use for demo purposes
- Real email/SMS, production monitoring, and strict security measures should be added before production deployment

Before real-world deployment, the following should be hardened:

- Use a strong `JWT_SECRET`
- Use the Supabase PostgreSQL connection pooler and a managed migration system such as Alembic
- Keep Supabase service-role credentials only on the backend
- Configure private Storage lifecycle, size limits, MIME validation, and malware scanning
- Restrict CORS to the actual frontend origin
- Set up secure SMTP or SMS provider credentials
- Enforce proper secret management and environment isolation
- Add production logging, monitoring, and audit trails

## Why this project matters

This project combines product thinking, backend engineering, and frontend implementation in one repository. It is a good example of:

- Building a fintech workflow rather than a toy CRUD app
- Implementing real decision logic instead of static placeholder screens
- Designing clear user flows and robust role-based authorization
- Creating a product demo that is easy to run and understand

It is especially relevant for roles such as:

- Full-stack developer
- Backend engineer
- Product-minded software engineer
- Fintech application developer
- Startup / MVP product builder

## File references of major implementation points

- Backend entrypoint: `backend/app/main.py`
- Database and session setup: `backend/app/database.py`
- Domain models: `backend/app/models.py`
- Pydantic schemas: `backend/app/schemas.py`
- Auth and JWT security: `backend/app/security.py`
- Customer app routes: `backend/app/routers/application.py`
- Auth routes: `backend/app/routers/auth.py`
- Verification OTP routes: `backend/app/routers/verification.py`
- Admin routes: `backend/app/routers/admin.py`
- Finance logic: `backend/app/utils/calculations.py`
- OTP dispatch simulation: `backend/app/utils/otp.py`
- Frontend entry app: `frontend/src/App.jsx`
- Auth state: `frontend/src/context/AuthContext.jsx`
- Login screen: `frontend/src/pages/Login.jsx`
- Customer app shell: `frontend/src/pages/CustomerApp.jsx`
- Admin dashboard: `frontend/src/pages/AdminDashboard.jsx`
- Admin detail review: `frontend/src/pages/AdminApplicationDetail.jsx`

## Final note

EzFinanz is a complete, demo-ready personal loan application system that demonstrates the practical implementation of lending workflows, customer onboarding, verification, decisioning, admin review, and disbursement operations in a single project.

This README captures the full project context so recruiters and reviewers can understand the scope, architecture, business logic, and technical decisions without needing to inspect the codebase line by line.
