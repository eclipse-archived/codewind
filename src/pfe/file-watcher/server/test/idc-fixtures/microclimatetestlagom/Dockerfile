FROM maven:3.5.4-jdk-8-alpine AS builder
COPY pom.xml .
COPY hello-api hello-api/
COPY hello-impl hello-impl/
RUN mvn install

FROM ibmjava:8-sfj
ENV AB_OFF=1 JAVA_MAIN_CLASS=play.core.server.ProdServerStart JAVA_APP_JAR=hello-impl-1.0-SNAPSHOT.jar
COPY --from=builder hello-api ./
COPY --from=builder hello-impl ./
COPY --from=builder hello-impl/target/alternateLocation /deployments/
EXPOSE 9000
CMD ["java", "-cp", "/deployments/*", "play.core.server.ProdServerStart"]
