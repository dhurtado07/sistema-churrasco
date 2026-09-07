import { io, type Socket } from "socket.io-client";
import { API_URL } from "./env";

export function crearSocket(token: string): Socket {
  return io(API_URL, {
    auth: { token },
    autoConnect: true,
  });
}
