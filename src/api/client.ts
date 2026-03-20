import axios from "axios";

export const api = axios.create({
  baseURL: "https://admin.macstore.com.np/api",
  headers: { Accept: "application/json" },
});
