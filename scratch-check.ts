import { loadConfig, resolveTarget } from "./src/config.js";
import { apiAuthHeaders } from "./src/auth/index.js";
async function main() {
  const cfg = loadConfig("e2e.config.yaml");
  const api = resolveTarget(cfg, "api");
  const headers = { "Content-Type": "application/json", ...apiAuthHeaders(api.auth, ".") };
  const res = await fetch(api.baseUrl + "/shipping-rates", { headers });
  const data: any = await res.json();
  console.log("total", data.total, data.rates?.map((r:any)=>({id:r.id,name:r.name})));
}
main();
