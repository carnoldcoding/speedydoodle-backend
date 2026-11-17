# Context

Definitions of the terms this project uses. Definitions only.

- **Public site**: the React application at `https://speedydoodle.com`. Any visitor can open it.
- **Public path**: a request that arrives through `https://api.speedydoodle.com`. Any device on the internet can use it.
- **Tailnet path**: a request that arrives through the tailnet address of the `nginx` container. Only a device on the owner's Tailscale network can use it.
- **Admin panel**: the pages under `https://speedydoodle.com/admin`. The admin user edits prices, site text, testimonials, and gallery items there, and reads quotes. It needs a login.
- **Admin user**: the one account that can log in to the admin panel. It belongs to the artist.
- **Technical page**: the page that the backend serves on the tailnet path. The developer changes technical settings and reads diagnostic data there. It has no login.
- **Quote**: one request that a visitor sends with the form on the services page. A quote has a type: live, custom, or other (a logo or an illustration).
- **Setting**: one named, typed value in the `settings` table. A setting is a price, a short text, or a technical value.
- **Content setting**: a setting that the admin user can change in the admin panel.
- **Technical setting**: a setting that only the technical page can change.
- **Gallery item**: one row that describes one image in ImageKit: its address, category, position, and caption.
- **Session**: one row that represents one login of the admin user. The browser holds its ID in a cookie.
