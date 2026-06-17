const path = require("path");
process.chdir(path.join(__dirname));
process.argv = ["node", "next", "dev", "--port", process.env.PORT || "3000"];
require("./node_modules/next/dist/bin/next");
