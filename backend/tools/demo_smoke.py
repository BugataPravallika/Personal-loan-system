import os
import requests
from time import sleep

BASE = os.environ.get('BASE_URL','http://localhost:8133')

print('Starting smoke demo against', BASE)

# Sign up
r = requests.post(BASE + '/api/auth/signup', json={
    'full_name': 'Demo User',
    'email': 'smokedemo@example.com',
    'password': 'password123'
})
print('signup', r.status_code, r.text)
assert r.status_code==200
tok = r.json()['access_token']
headers = {'Authorization': f'Bearer {tok}'}

# Check application.me
r = requests.get(BASE + '/api/application/me', headers=headers)
print('/application/me', r.status_code, r.json())

# Try KYC (should be 403)
kyc = {'full_name':'Demo User','dob':'1990-01-01','gender':'Other','address':'Demo','id_type':'passport','id_number':'D123'}
r = requests.post(BASE + '/api/application/kyc', headers=headers, json=kyc)
print('kyc before verify', r.status_code, r.text)

# Request email OTP
r = requests.post(BASE + '/api/verification/request-otp', headers=headers, json={'channel':'email'})
print('request email otp', r.status_code, r.text)
email_code = r.json().get('dev_otp')

# Verify email
r = requests.post(BASE + '/api/verification/verify-otp', headers=headers, json={'channel':'email','code':email_code})
print('verify email', r.status_code, r.text)

# Request phone OTP
r = requests.post(BASE + '/api/verification/request-otp', headers=headers, json={'channel':'phone','destination':'+919960000106'})
print('request phone otp', r.status_code, r.text)
phone_code = r.json().get('dev_otp')

# Verify phone
r = requests.post(BASE + '/api/verification/verify-otp', headers=headers, json={'channel':'phone','code':phone_code,'destination':'+919960000106'})
print('verify phone', r.status_code, r.text)

# Now try KYC
r = requests.post(BASE + '/api/application/kyc', headers=headers, json=kyc)
print('kyc after verify', r.status_code, r.text)
print('Smoke demo completed')
