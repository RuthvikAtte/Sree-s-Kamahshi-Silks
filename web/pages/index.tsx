import useSWR from "swr";
import Link from "next/link";
import Layout from "../components/Layout";

type Product = {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  available: boolean;
};
const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function Home() {
  const base = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL;
  const { data, error, isLoading } = useSWR(base + "/products", fetcher);

  return (
    <Layout>
      <h1 style={{ marginBottom: 16 }}>New Arrivals</h1>
      {isLoading && <p>Loading...</p>}
      {error && <p>Failed to load products.</p>}
      <div className="grid">
        {(data?.products || []).map((p: Product) => (
          <div key={p.id} className="card">
            <Link href={`/product/${p.id}`}>
              <img src={p.image_url} alt={p.name} />
            </Link>
            <div className="info">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div className="price">₹{(p.price / 100).toFixed(0)}</div>
                </div>
                {!p.available && <span style={{ color: "#b00" }}>Sold</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
