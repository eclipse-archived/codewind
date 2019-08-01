const { ProjectType } = require('../types/initializeTypes')

const projectTypesWithInternalDebugPort: string[] = [
  ProjectType.LIBERTY.toString(),
  ProjectType.SPRING.toString(),
  ProjectType.NODEJS.toString(),
];

const projectTypesWithMavenSettings: string[] = [
  ProjectType.LIBERTY.toString(),
  ProjectType.SPRING.toString(),
];

export {
  projectTypesWithInternalDebugPort,
  projectTypesWithMavenSettings,
};