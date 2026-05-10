# GitHub Actions CI Pipeline Setup

Your project now has a comprehensive CI/CD pipeline configured. Here's what's included:

## Pipeline Overview

The workflow runs automatically on:

- **Pushes** to `main` and `develop` branches
- **Pull requests** to `main` and `develop` branches

### Jobs

#### 1. **Lint**

- Runs ESLint to check code quality
- Ensures code style consistency
- Runs on every push and pull request

#### 2. **Type Check**

- Runs TypeScript compiler in check mode
- Verifies type correctness without emitting files
- Runs on every push and pull request

#### 3. **Build**

- Builds the project with Vite
- Uploads build artifacts for inspection
- Artifacts are retained for 7 days
- Runs on every push and pull request

## Running the Pipeline Locally (Optional)

To test the pipeline locally before pushing, you can use [Act](https://github.com/nektos/act):

```bash
# Install Act (if not already installed)
# Then run:
act push -b main
```

## Customization

### Adding Tests

If you want to add testing, create a new job in `.github/workflows/ci.yml`:

```yaml
test:
  name: Tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Install Bun
      uses: oven-sh/setup-bun@v1
    - name: Install dependencies
      run: bun install
    - name: Run tests
      run: bun test # Adjust this command based on your test setup
```

### Changing Trigger Branches

Edit the `on` section in `.github/workflows/ci.yml` to add or remove branches.

## Status Badges

Add this to your README.md to show CI status:

```markdown
![CI](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml/badge.svg)
```

Replace `YOUR_USERNAME` and `YOUR_REPO` with your actual GitHub username and repository name.

## Troubleshooting

**Build fails locally but passes in CI (or vice versa):**

- Check Bun version differences (`bun --version`)
- Clear node_modules and reinstall: `bun install --force`

**Type check fails:**

- Run locally: `bunx tsc --noEmit`
- Check for TypeScript errors in your IDE

For more help with GitHub Actions, see the [official documentation](https://docs.github.com/en/actions).
