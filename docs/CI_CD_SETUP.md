# 🚀 CI/CD Pipeline Setup Guide

This guide will help you set up the complete CI/CD pipeline for the AI Agent Orchestrator project.

## 📋 Prerequisites

- GitHub repository with admin access
- Vercel account
- Railway account (for backend)
- Slack workspace (optional, for notifications)

## 🔧 Step 1: GitHub Repository Setup

### 1.1 Enable GitHub Actions
1. Go to your repository settings
2. Navigate to "Actions" → "General"
3. Ensure "Allow all actions and reusable workflows" is selected
4. Save changes

### 1.2 Configure Branch Protection
1. Go to "Branches" in repository settings
2. Add rule for `main` branch:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators
   - ✅ Restrict pushes that create files
   - ✅ Require linear history

### 1.3 Set up Required Status Checks
Add these status checks to branch protection:
- `frontend-lint-test`
- `backend-lint-test`
- `frontend-build`
- `backend-build`
- `security-scan`

## 🔑 Step 2: GitHub Secrets Configuration

Add the following secrets to your GitHub repository:

### 2.1 Vercel Secrets
```bash
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_org_id
VERCEL_PROJECT_ID=your_project_id
```

### 2.2 Railway Secrets
```bash
RAILWAY_TOKEN=your_railway_token
```

### 2.3 Environment Variables
```bash
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
NEXT_PUBLIC_WS_URL=wss://your-backend-url.railway.app
```

### 2.4 Optional: Slack Notifications
```bash
SLACK_WEBHOOK_URL=your_slack_webhook_url
```

## 🚀 Step 3: Vercel Setup

### 3.1 Install Vercel CLI
```bash
npm install -g vercel
```

### 3.2 Login to Vercel
```bash
vercel login
```

### 3.3 Link Project
```bash
cd frontend
vercel link
```

### 3.4 Get Project Information
```bash
vercel project ls
# Note down the Project ID and Org ID
```

### 3.5 Configure Environment Variables
```bash
vercel env add NEXT_PUBLIC_API_URL
vercel env add NEXT_PUBLIC_WS_URL
```

## 🛤️ Step 4: Railway Setup

### 4.1 Install Railway CLI
```bash
npm install -g @railway/cli
```

### 4.2 Login to Railway
```bash
railway login
```

### 4.3 Create New Project
```bash
cd backend
railway init
```

### 4.4 Configure Environment Variables
```bash
railway variables set NODE_ENV=production
railway variables set DATABASE_URL=your_database_url
railway variables set CEREBRAS_API_KEY=your_cerebras_key
```

## 🧪 Step 5: Testing Setup

### 5.1 Frontend Testing
Add to `frontend/package.json`:
```json
{
  "scripts": {
    "test:ci": "jest --ci --coverage --watchAll=false",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  }
}
```

### 5.2 Backend Testing
Add to `backend/package.json`:
```json
{
  "scripts": {
    "test": "vitest run --coverage",
    "lint": "eslint src/**/*.ts",
    "type-check": "tsc --noEmit"
  }
}
```

## 🔍 Step 6: Security Scanning

### 6.1 Enable GitHub Security Features
1. Go to repository settings
2. Navigate to "Security" → "Code security and analysis"
3. Enable:
   - ✅ Dependabot alerts
   - ✅ Dependabot security updates
   - ✅ Code scanning
   - ✅ Secret scanning

### 6.2 Configure CodeQL Analysis
The CI/CD pipeline includes Trivy vulnerability scanning. You can also set up CodeQL:

1. Go to "Security" → "Code scanning"
2. Click "Set up code scanning"
3. Choose "CodeQL Analysis"
4. Select "Default" configuration

## 📊 Step 7: Monitoring Setup

### 7.1 Code Coverage
The pipeline uploads coverage reports to Codecov. Set up Codecov:

1. Go to [codecov.io](https://codecov.io)
2. Connect your GitHub repository
3. Add the Codecov token to GitHub secrets if needed

### 7.2 Performance Monitoring
Consider setting up:
- Vercel Analytics
- Railway Metrics
- Application Performance Monitoring (APM)

## 🚀 Step 8: Deployment Verification

### 8.1 Test the Pipeline
1. Make a small change to your code
2. Push to a feature branch
3. Create a pull request
4. Verify all checks pass
5. Merge to main
6. Monitor deployment

### 8.2 Verify Deployments
- **Frontend:** Check Vercel dashboard for successful deployment
- **Backend:** Check Railway dashboard for successful deployment
- **Health Checks:** Verify `/health` endpoints are working

## 🔧 Step 9: Advanced Configuration

### 9.1 Custom Domains
```bash
# Vercel
vercel domains add your-domain.com

# Railway
railway domain
```

### 9.2 SSL Certificates
Both Vercel and Railway provide automatic SSL certificates.

### 9.3 CDN Configuration
Vercel automatically provides CDN for static assets.

## 🚨 Troubleshooting

### Common Issues

#### 1. Build Failures
- Check Node.js version compatibility
- Verify all dependencies are installed
- Check for TypeScript errors

#### 2. Deployment Failures
- Verify environment variables are set correctly
- Check API keys and tokens
- Review deployment logs

#### 3. Test Failures
- Ensure test database is properly configured
- Check for flaky tests
- Verify test environment variables

### Debug Commands
```bash
# Check GitHub Actions logs
gh run list
gh run view <run-id>

# Check Vercel deployment
vercel ls
vercel logs

# Check Railway deployment
railway logs
railway status
```

## 📈 Step 10: Optimization

### 10.1 Performance Optimization
- Enable build caching
- Optimize Docker images
- Use parallel jobs where possible

### 10.2 Cost Optimization
- Monitor build minutes usage
- Optimize test execution time
- Use appropriate runner types

## 🔄 Step 11: Maintenance

### 11.1 Regular Tasks
- Review and update dependencies weekly
- Monitor security alerts
- Update CI/CD workflows as needed
- Review and optimize build times

### 11.2 Monitoring
- Set up alerts for failed deployments
- Monitor build times and costs
- Track test coverage trends

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**🎉 Your CI/CD pipeline is now ready for production!**

For support, check the troubleshooting section or create an issue in the repository. 