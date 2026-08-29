import { testRender } from "@opentui/solid";
const { ThemeProvider } = await import("../src/context/ThemeContext");
const { PaneRow } = await import("../src/components/PaneRow");
process.env.XDG_CONFIG_HOME = import.meta.dir + "/../.harness/config-home";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "hv-"));
const setup = (await testRender(
  () => React.createElement... 
));
