import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import express, { Request, Response } from "express";
import cors from "cors";
import Stripe from "stripe";

admin.initializeApp();
const firestore = admin.firestore();
const storage = admin.storage();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2023-10-16" });

// Express app for HTTP APIs
const app = express();
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-secret"],
}));
app.options("*", cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-secret"],
}));
app.use(express.json());

// Types
type Product = {
  id: string;
  name: string;
  price: number; // in smallest currency unit (e.g., INR paise)
  description: string;
  image_url: string;
  available: boolean;
  created_at: admin.firestore.Timestamp;
};

// Middleware: verify Firebase Auth ID token
async function verifyAuth(req: Request, _res: Response, next: Function) {
  try {
    const authHeader = req.header("authorization") || req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      // not authenticated; proceed without user
      // @ts-ignore
      req.user = null;
      return next();
    }
    const idToken = authHeader.substring(7);
    const decoded = await admin.auth().verifyIdToken(idToken);
    // @ts-ignore
    req.user = decoded;
    return next();
  } catch (e) {
    // @ts-ignore
    req.user = null;
    return next();
  }
}

app.use(verifyAuth);

// GET /products
app.get("/products", async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore.collection("products").orderBy("created_at", "desc").get();
    const products: Product[] = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Product, "id">) } as Product));
    res.json({ products });
  } catch (error) {
    functions.logger.error("GET /products error", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Helper: require admin via Firebase custom claims
function assertAdmin(req: Request) {
  // @ts-ignore
  const user = req.user as admin.auth.DecodedIdToken | null;
  const headerSecret = req.header("x-admin-secret");
  const adminSecret = process.env.ADMIN_API_SECRET;
  const hasSecret = adminSecret && headerSecret === adminSecret;
  if (user?.admin === true || hasSecret) return;
  const err = new Error("Unauthorized");
  // @ts-ignore
  err.statusCode = 401;
  throw err;
}

// POST /products (multipart unsupported in this minimal example)
// Expects JSON: { name, price, description, image_url }
app.post("/products", async (req: Request, res: Response) => {
  try {
    assertAdmin(req);
    const { name, price, description, image_url } = req.body || {};
    if (!name || !price || !description || !image_url) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const productData = {
      name,
      price: Number(price),
      description,
      image_url,
      available: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await firestore.collection("products").add(productData);
    res.status(201).json({ id: ref.id, ...productData });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    functions.logger.error("POST /products error", error);
    res.status(status).json({ error: error?.message || "Failed to add product" });
  }
});

// POST /checkout
// Body: { productId, successUrl, cancelUrl, currency }
app.post("/checkout", async (req: Request, res: Response) => {
  try {
    const { productId, successUrl, cancelUrl, currency = "inr" } = req.body || {};
    if (!productId || !successUrl || !cancelUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const productRef = firestore.collection("products").doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists) {
      return res.status(404).json({ error: "Product not found" });
    }
    const product = productSnap.data() as Product;
    if (!product.available) {
      return res.status(409).json({ error: "Product already sold" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: product.name,
              description: product.description,
              images: [product.image_url],
            },
            unit_amount: product.price,
          },
          quantity: 1,
        },
      ],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&product_id=${productId}`,
      cancel_url: cancelUrl,
      metadata: {
        productId,
      },
    });

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    functions.logger.error("POST /checkout error", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// POST /sms-webhook (for Twilio or similar)
app.post("/sms-webhook", async (req: Request, res: Response) => {
  try {
    functions.logger.info("SMS webhook payload", req.body);
    res.status(200).send("OK");
  } catch (e) {
    res.status(500).send("Failed");
  }
});

// Stripe webhook to mark as sold
export const stripeWebhook = functions.region('us-east1').https.onRequest(async (req, res): Promise<void> => {
  const sig = req.headers["stripe-signature"] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
  let event: Stripe.Event;

  try {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err: any) {
    functions.logger.error("Webhook signature verification failed.", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const productId = (session.metadata as any)?.productId;
      if (productId) {
        await firestore.runTransaction(async (tx) => {
          const productRef = firestore.collection("products").doc(productId);
          const snap = await tx.get(productRef);
          if (snap.exists) {
            const data = snap.data() as Product;
            if (data.available) {
              tx.update(productRef, { available: false });
            }
          }
        });
      }
    }
    res.json({ received: true });
    return;
  } catch (e) {
    functions.logger.error("Webhook processing error", e);
    res.status(500).send("Webhook handler failed");
    return;
  }
});

// Export Express app as a single HTTPS function
export const api = functions.region('us-east1').https.onRequest(app);


