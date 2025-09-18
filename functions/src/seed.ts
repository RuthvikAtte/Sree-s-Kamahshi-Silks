import * as admin from 'firebase-admin'

// Prefer emulator if available
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080'
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'srees-kamakshi-silks'

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT })
}

const db = admin.firestore()

async function run(){
  const products = [
    { name:'Kanchipuram Silk - Maroon Zari', price: 1499900, description:'Handwoven Kanchipuram silk with rich maroon and antique zari border.', image_url:'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=1200&auto=format&fit=crop' },
    { name:'Banarasi Silk - Sunset Orange', price: 1299900, description:'Classic Banarasi with intricate buttas in vibrant orange.', image_url:'https://images.unsplash.com/photo-1582738412138-2f57b11a1785?q=80&w=1200&auto=format&fit=crop' },
    { name:'Tussar Silk - Elegant Gold', price: 899900, description:'Elegant tussar in gold hues with minimalist pallu.', image_url:'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&w=1200&auto=format&fit=crop' },
  ]
  for(const p of products){
    await db.collection('products').add({ ...p, available:true, created_at: admin.firestore.FieldValue.serverTimestamp() })
  }
  console.log('Seeded sample products')
}

run().then(()=>process.exit(0)).catch((e)=>{console.error(e); process.exit(1)})


