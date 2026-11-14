// Mapa de páginas do site.
import { Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Portal from "./pages/Portal";
import ComoFunciona from "./pages/ComoFunciona";
import RedefinirSenha from "./pages/RedefinirSenha";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Register />} />
      <Route path="/portal" element={<RequireAuth><Portal /></RequireAuth>} />
      <Route path="/como-funciona" element={<ComoFunciona />} />
      <Route path="*" element={<Landing />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
    </Routes>
  );
}
