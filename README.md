# vite-plugin-umd-proxy

You can use this library to perform a simple UMD module conversion.

## Usage

```typescript
import { defineConfig } from "vite";
import umdProxy from "vite-plugin-umd-proxy";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    umdProxy({
      name: "React",
    }),
  ],
});
```
