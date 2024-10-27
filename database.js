const admin = require('firebase-admin');
require('dotenv').config();


const serviceAccount = {
  type: process.env.API_Type,
  project_id: process.env.API_Project_id,
  private_key_id: process.env.API_Private_key_id,
  private_key: process.env.API_Private_key.replace(/\\n/g, '\n'),
  client_email: process.env.API_Client_email,
  client_id: process.env.API_Client_id,
  auth_uri: process.env.API_Auth_uri,
  token_uri: process.env.API_Token_uri,
  auth_provider_x509_cert_url: process.env.API_Auth_provider_x509_cert_url,
  client_x509_cert_url: process.env.API_Client_x509_cert_url,
  universe_domain: process.env.API_Universe_domain
};


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = db;
