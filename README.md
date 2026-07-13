# All-Purpose Discord Bot

A production-ready Discord bot built with **TypeScript** and **discord.js v14**. Includes moderation, utility, fun, and admin commands with owner bypass support.

## Features

- **22 slash commands** across moderation, utility, fun, and admin categories
- **Owner bypass** — configured owner ID bypasses all permission checks on every server
- **Permission system** — role hierarchy respected for moderation actions
- **Warning system** — persistent per-guild warnings stored on disk
- **Railway-ready** — deploys with zero config beyond environment variables

## Commands

| Category | Commands |
|----------|----------|
| Moderation | `/ban`, `/kick`, `/mute`, `/unmute`, `/purge`, `/warn`, `/warnings`, `/clearwarnings`, `/role` |
| Utility | `/ping`, `/help`, `/userinfo`, `/serverinfo`, `/avatar`, `/botinfo`, `/poll` |
| Fun | `/8ball`, `/coinflip` |
| Admin | `/say`, `/embed`, `/eval` (owner only) |

## Setup

### 1. Environment variables

Copy `.env.example` to `.env` and fill in your values:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_client_id
OWNER_ID=700521407502614540
NODE_ENV=production
```

### 2. Install and build

```bash
npm install
npm run build
npm run deploy-commands
npm start
```

### 3. Invite the bot

Use this URL (replace `CLIENT_ID`):

```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

## Railway Deployment

1. Push this repo to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect your GitHub repository
4. Add environment variables in Railway dashboard:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `OWNER_ID`
   - `NODE_ENV=production`
5. Deploy — Railway runs `npm run build` then `npm start`

After first deploy, run `npm run deploy-commands` locally once to register slash commands globally.

## Project Structure

```
src/
├── commands/       # Slash commands by category
├── events/         # Discord event handlers
├── handlers/       # Command & event loader
├── utils/          # Permissions, embeds, warnings
├── client.ts       # Discord client factory
├── config.ts       # Environment config
├── deploy-commands.ts
└── index.ts        # Entry point
```

## Security

- Never commit `.env` or bot tokens to GitHub
- Regenerate your token if it has been exposed publicly
- `/eval` is restricted to the configured owner ID only

## License

MIT
