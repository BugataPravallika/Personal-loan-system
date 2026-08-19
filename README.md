# EzFinanz — Personal Loan Management System

EzFinanz is a full-stack loan application and approval platform designed to simulate a real digital lending workflow. It walks a customer from signup to application submission, eligibility review, EMI selection, declaration, selfie verification, and final admin approval or disbursement. The app is built as a practical demo for recruiters, evaluators, and technical reviewers to understand the product flow, backend logic, and UI implementation.

This project demonstrates end-to-end application architecture: secure authentication, role-based access control, workflow state management, file upload handling, financial calculations, and admin review operations.

## Recruiter-facing summary

- Full-stack fintech demo with a customer onboarding flow and admin approval workflow
- Built using FastAPI + React with SQLite as the default data store
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

The backend and frontend are intentionally easy to run locally without external services. OTPs, file uploads, and mock verification events are simulated so reviewers can understand the full workflow without requiring production-grade infrastructure.

## Project structure

```text
ezfinanz/
├── README.md
├── backend/
│   ├── .env.example
│   ├── Procfile
│   ├── requirements.txt
│   ├── seed.py
│   ├── ezfinanz.db
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
  - Stores verification codes, expiry, destination, and message content
  - Used for email and phone verification flow

- `LoanApplication`
  - Top-level application container
  - Tracks current application stage and overall status
  - Linked to KYC, eligibility, EMI, bank, declaration, and selfie data

- `KYCDetail`
  - Stores personal data and ID information
  - Optional document path is saved for uploaded ID proof

- `EligibilityCheck`
  - Stores annual income, requested amount, credit score, debt burden, employer info, DTI ratio, result, and maximum eligible amount

- `EMISelection`
  - Stores chosen loan amount, tenure, rate, charges, disbursement, EMI, total repayment, and calculated IRR

- `BankAccount`
  - Stores account holder name, account number, IFSC, and bank name

- `Declaration`
  - Tracks whether the applicant accepted the final declaration

- `Selfie`
  - Stores selfie file path, status, rejection reason, reviewer ID, and review timestamp

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

- OTP codes are exposed in responses as `dev_otp`
- The frontend can show OTPs in the inbox panel for easier testing
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

### Important note on database config

The app is currently configured to use SQLite by default through `backend/app/database.py` at:

```text
backend/ezfinanz.db
```

This keeps the app quick to run locally. Because the app is built with SQLAlchemy, the underlying database can be swapped to Postgres or MySQL by updating the engine configuration in `database.py`.

## Running the application locally

### 1) Backend start

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload --port 8000
```

### 2) Frontend start

```bash
cd frontend
npm install
npm run dev
```

### 3) Access the app

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

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

## Production concerns and demo disclaimers

This project is intended for technical demonstration and local review. Certain aspects are intentionally simplified for clarity:

- CORS is open for local demo use
- OTP delivery is simulated and can be shown in-app
- The database is SQLite by default instead of production-grade Postgres or MySQL
- The default admin credentials are intentionally easy to use for demo purposes
- Real email/SMS, production monitoring, and strict security measures should be added before production deployment

Before real-world deployment, the following should be hardened:

- Use a strong `JWT_SECRET`
- Replace local SQLite with a managed database
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
