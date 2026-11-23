import type { Metadata } from "next";
import { PantallaReservas } from "./pantalla-reservas";

export const metadata: Metadata = {
  title: "Reservar cancha",
  description: "Elige cancha, fecha y bloque de 1 hora para reservar.",
};

export default function PaginaReservas() {
  return <PantallaReservas />;
}
