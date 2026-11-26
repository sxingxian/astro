-- bcrypt password hashing runs inside Postgres (crypt/gen_salt), so the app Worker stays within the
-- Workers Free plan's 10 ms CPU per request. pgcrypto is a trusted extension; on Neon the project owner
-- can also create it beforehand (docs/DEPLOYMENT.md, section 4).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
