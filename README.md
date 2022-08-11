# vite-plugin-var-proxy

You can use this library to perform a simple window module conversion.

## Usage

```typescript
import { defineConfig } from "vite";
import varProxy from "vite-plugin-var-proxy";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    varProxy({
      name: "React",
    }),
  ],
});
```
