import { Outlet } from "react-router-dom";
import { Footer } from "./Footer";
import { Header } from "./Header";

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
