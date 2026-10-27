import Dashboard from "@/components/Dashboard";

export default function HomePage() {
  return <Dashboard mock={process.env.DROPS_MOCK === "1"} />;
}
