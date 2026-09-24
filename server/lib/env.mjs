// Load env before anything reads process.env (ES imports are hoisted, so this
// must be imported first by modules that need configuration).
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
dotenv.config()
