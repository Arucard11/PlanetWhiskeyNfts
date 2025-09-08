# Memory Management for Planet Whiskey NFTs

## Issue
The Next.js development server was running out of memory with the error:
```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
```

## Solution
We've implemented several solutions to prevent memory issues:

### 1. Updated Package.json Scripts
The `dev` and `build` scripts now include memory limits:
```json
{
  "scripts": {
    "dev": "NODE_OPTIONS='--max-old-space-size=4096' next dev",
    "build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
  }
}
```

### 2. Memory Management Script
A dedicated script for running the dev server with proper memory settings:
```bash
npm run dev-memory
```

### 3. Environment Variables
Set in your `.env.local` file:
```bash
NODE_OPTIONS=--max-old-space-size=4096
```

## Available Commands

### Development
```bash
# Standard dev server with memory limit
npm run dev

# Alternative with memory management script
npm run dev-memory

# Manual with custom memory limit
NODE_OPTIONS='--max-old-space-size=8192' npm run dev
```

### Build
```bash
# Build with memory limit
npm run build

# Manual with custom memory limit
NODE_OPTIONS='--max-old-space-size=8192' npm run build
```

## Memory Limit Options

- `--max-old-space-size=2048` - 2GB (minimum recommended)
- `--max-old-space-size=4096` - 4GB (current setting)
- `--max-old-space-size=8192` - 8GB (for large projects)

## Troubleshooting

If you still encounter memory issues:

1. **Increase memory limit**:
   ```bash
   NODE_OPTIONS='--max-old-space-size=8192' npm run dev
   ```

2. **Clear Next.js cache**:
   ```bash
   rm -rf .next
   npm run dev
   ```

3. **Restart the development server**:
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   ```

4. **Check system memory**:
   ```bash
   free -h
   ```

## Why This Happens

- Large dependency tree (Anchor, Solana, Metaplex)
- Complex TypeScript compilation
- Hot reloading with many files
- Memory leaks in development mode

## Prevention

- Always use the memory-limited scripts
- Restart the dev server periodically
- Monitor memory usage during development
- Keep dependencies updated
