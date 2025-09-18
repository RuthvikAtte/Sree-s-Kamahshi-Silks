import * as admin from 'firebase-admin'

if (!admin.apps.length) {
  admin.initializeApp()
}

async function grant(email: string){
  const user = await admin.auth().getUserByEmail(email)
  const claims = user.customClaims || {}
  claims.admin = true
  await admin.auth().setCustomUserClaims(user.uid, claims)
  console.log(`Granted admin to ${email}`)
}

const email = process.argv[2]
if(!email){
  console.error('Usage: ts-node src/grantAdmin.ts user@example.com')
  process.exit(1)
}

grant(email).then(()=>process.exit(0)).catch((e)=>{console.error(e); process.exit(1)})


