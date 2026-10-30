# Contributing to KubekOS

Thank you for your interest in contributing to **KubekOS**!

## Development Workflow

1. **Fork & Clone** the repository.
2. **Install dependencies** using `npm install`.
3. **Create a feature branch** (`git checkout -b feat/your-feature`).
4. **Follow Quality & Security Standards**:
   - Maintain strict TypeScript typing (`npm run lint` must report `0` errors).
   - Never introduce `eval()`, `new Function()`, or unsanitized HTML rendering.
   - Ensure all Virtual Filesystem mutations persist through `useVfsStore` / `osDb` (Dexie IndexedDB).
   - Include unit tests (`src/**/*.test.ts`) for new services or applications.
5. **Verify your changes**:
   ```bash
   npm run lint
   npm test
   npm run build
   ```
6. **Open a Pull Request** with a clear summary of your architectural or UI changes.
