import { Navigate, Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import Compare from "./pages/Compare.jsx";
import Explore from "./pages/Explore.jsx";
import Methodology from "./pages/Methodology.jsx";

export default function App() {
  return (
    <div className="flex min-h-[100dvh] flex-col font-sans text-ink">
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/methodology" element={<Methodology />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </div>
  );
}
