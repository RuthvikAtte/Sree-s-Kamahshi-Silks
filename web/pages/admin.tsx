import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { getClientAuth, getClientStorage } from "../src/lib/firebase";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function Admin() {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("");
  const base = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL;
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const auth = getClientAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  async function signIn() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(getClientAuth(), provider);
  }

  async function doSignOut() {
    await signOut(getClientAuth());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!base) {
      setStatus("Missing NEXT_PUBLIC_FUNCTIONS_BASE_URL");
      return;
    }
    const hasDevSecret = !!process.env.NEXT_PUBLIC_ADMIN_API_SECRET;
    if (!user && !hasDevSecret) {
      setStatus("Please sign in first");
      return;
    }
    try {
      setStatus("Submitting...");
      const token = user ? await user.getIdToken() : "";
      const res = await fetch(base + "/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(process.env.NEXT_PUBLIC_ADMIN_API_SECRET
            ? { "x-admin-secret": process.env.NEXT_PUBLIC_ADMIN_API_SECRET }
            : {}),
        },
        body: JSON.stringify({
          name,
          price: Math.round(Number(price) * 100),
          description,
          image_url: imageUrl,
        }),
      });
      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {}
      if (res.ok) {
        setStatus("Created " + (json.id || ""));
        setName("");
        setPrice("");
        setDescription("");
        setImageUrl("");
      } else {
        setStatus(json.error || `Request failed (${res.status})`);
      }
    } catch (err: any) {
      setStatus(err?.message || "Network error");
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Uploading image...");
    const key = `saree_images/${Date.now()}_${file.name}`;
    const storageRef = ref(getClientStorage(), key);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    setImageUrl(url);
    setStatus("Image uploaded");
  }

  return (
    <Layout>
      <h1>Admin: Add Saree</h1>
      {!user ? (
        <div style={{ marginBottom: 16 }}>
          <button className="btn" onClick={signIn}>
            Sign in with Google
          </button>
          <p style={{ opacity: 0.7, marginTop: 8 }}>
            Sign-in required to access admin form.
          </p>
        </div>
      ) : (
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>Signed in as {user.email}</span>
          <button className="btn secondary" onClick={doSignOut}>
            Sign out
          </button>
        </div>
      )}
      <form
        onSubmit={submit}
        style={{ display: "grid", gap: 12, maxWidth: 540 }}
      >
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Price (INR)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <input type="file" accept="image/*" onChange={onFileChange} />
        <input
          placeholder="Image URL"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button className="btn" type="submit">
          Add
        </button>
      </form>
      <p>{status}</p>
      <p style={{ opacity: 0.7 }}>
        Note: Protect with Firebase Auth in production. This demo uses an admin
        secret.
      </p>
    </Layout>
  );
}
