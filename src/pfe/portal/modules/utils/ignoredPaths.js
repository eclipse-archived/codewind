const defaultIgnoredPaths = ["*/.idea/*", "*.iml", "/.project", "/load-test*", "*/*.swp", "*/*.swx", 
  "*/.gitignore", "*/node_modules*", "*/4913", "*/.git/*", "*/.DS_Store", 
  "*/.dockerignore", "*/*~", "/.settings"];

const dockerIgnoredPaths = [...defaultIgnoredPaths];

const swiftIgnoredPaths = [...defaultIgnoredPaths, "/LICENSE", "/Package.resolved", "README.rtf", "/debian", "/manifest.yml", 
  "/cli-config.yml", "/README.md", "/Jenkinsfile", "/.bluemix", "/iterative-dev.sh", "/terraform",
  ".swift-version", "/.build-ubuntu", "/.cfignore", "/.swiftservergenerator-project", "/.yo-rc.json"];

const nodeIgnoredPaths =  [...defaultIgnoredPaths, "/run-dev", "/run-debug", "/package-lock.json*", "/nodejs_restclient.log", "/nodejs_dc.log",
  "/manifest.yml", "/idt.js", "/cli-config.yml", "/README.md", "/Jenkinsfile", "/.cfignore"];

const springIgnoredPaths = [...defaultIgnoredPaths, "/target", "/Dockerfile-tools",
  "/cli-config.yml", "/README.md", "/Jenkinsfile", "/.m2", "/localm2cache.zip"];

const libertyIgnoredPaths = [...defaultIgnoredPaths, "/Dockerfile-tools", "/target",
  "/mc-target", "/cli-config.yml", "/README.md", "/Jenkinsfile", "/.cfignore", "/localm2cache.zip", "/libertyrepocache.zip"];

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