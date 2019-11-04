const dockerIgnoredPaths = ["/.project", "*/node_modules*", "*/.git/*", "*/.DS_Store", "*/*.swp", "*/*.swx", "*/4913", "/load-test*",
  "*/.dockerignore", "*/.gitignore", "*/*~", "/.settings"];

const swiftIgnoredPaths = ["/.project", "/LICENSE", "/Package.resolved", "README.rtf", "/debian", "/manifest.yml", "/load-test*",
  "/cli-config.yml", "/README.md", "/Jenkinsfile", "/.bluemix", "/iterative-dev.sh", "/terraform",
  ".swift-version", "/.build-ubuntu", "/.cfignore", "/.swiftservergenerator-project", "/.yo-rc.json",
  "*/node_modules*", "*/.git/*", "*/.DS_Store", "*/*.swp", "*/*.swx", "*/4913", "*/.dockerignore",
  "*/.gitignore", "*/*~", "/.settings"];

const nodeIgnoredPaths =  ["/.project", "/run-dev", "/run-debug", "/package-lock.json*", "/nodejs_restclient.log", "/nodejs_dc.log",
  "/manifest.yml", "/idt.js", "/cli-config.yml", "/README.md", "/Jenkinsfile", "/.cfignore", "/load-test*",
  "*/node_modules*", "*/.git/*", "*/.DS_Store", "*/*.swp", "*/*.swx", "*/4913", "*/.dockerignore", "*/.gitignore",
  "*/*~", "/.settings"];

const springIgnoredPaths = ["/.project", "/target", "/Dockerfile-tools",
  "/cli-config.yml", "/README.md", "/Jenkinsfile", "/.m2", "/load-test*",
  "*/node_modules*", "*/.git/*", "*/.DS_Store", "*/*.swp", "*/*.swx",
  "*/4913", "*/.dockerignore", "*/.gitignore", "*/*~", "/.settings", "/localm2cache.zip"];

const libertyIgnoredPaths = ["/.project", "/Dockerfile-tools", "/target",
  "/mc-target", "/cli-config.yml", "/README.md", "/Jenkinsfile", "/.cfignore", "/load-test*",
  "*/node_modules*", "*/.git/*", "*/.DS_Store", "*/*.swp", "*/*.swx", "*/4913", "*/.dockerignore",
  "*/.gitignore", "*/*~", "/.settings", "/localm2cache.zip", "/libertyrepocache.zip"];

const projectTypeToIgnoredPaths = {
  'swift': swiftIgnoredPaths,
  'nodejs': nodeIgnoredPaths,
  'spring': springIgnoredPaths,
  'liberty': libertyIgnoredPaths,
  'docker': dockerIgnoredPaths,
}

module.exports = {
  projectTypeToIgnoredPaths,
  dockerIgnoredPaths,
}