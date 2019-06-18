## Microservice
IBM Cloud Microservice Starter for Spring

[![](https://img.shields.io/badge/IBM%20Cloud-powered-blue.svg)](https://bluemix.net)
[![Platform](https://img.shields.io/badge/platform-java-lightgrey.svg?style=flat)](https://www.ibm.com/developerworks/learn/java/)

### Table of Contents
* [Summary](#summary)
* [Requirements](#requirements)
* [Configuration](#configuration)
* [Project contents](#project-contents)
* [Run](#run)

### Summary

The IBM Cloud Microservice Starter in Java provides a starting point for creating Java microservice applications running on [Spring](https://spring.io/).

To deploy this application to IBM Cloud using a toolchain click the **Create Toolchain** button.
[![Create Toolchain](https://console.ng.bluemix.net/devops/graphics/create_toolchain_button.png)](https://console.ng.bluemix.net/devops/setup/deploy/)

### Requirements
* [Maven](https://maven.apache.org/install.html)
* Java 8: Any compliant JVM should work.
  * [Java 8 JDK from Oracle](http://www.oracle.com/technetwork/java/javase/downloads/index.html)
  * [Java 8 JDK from IBM (AIX, Linux, z/OS, IBM i)](http://www.ibm.com/developerworks/java/jdk/)

### Configuration
Capabilities are provided through dependencies in the pom.xml file.

### Project contents
The ports are set to the defaults of 8080 for http and 8443 for https and are exposed to the CLI in the cli-config.yml file.

The project contains IBM Cloud specific files that are used to deploy the application as part of a IBM Cloud DevOps flow. The `.bluemix` directory contains files used to define the IBM Cloud toolchain and pipeline for your application. The `manifest.yml` file specifies the name of your application in IBM Cloud, the timeout value during deployment and which services to bind to.

This microservice application is configured to connect to the following services :

Credentials are either taken from the VCAP_SERVICES environment variable that IBM Cloud provides or from environment variables passed in by the config file `src/main/resources/localdev-config.json`.

### Run

To build and run the application:
1. `mvn install`
1. `java -jar ./target/springfolderimporttest-1.0-SNAPSHOT.jar`

To run the application in Docker use the Docker file called `Dockerfile`. If you do not want to install Maven locally you can use `Dockerfile-tools` to build a container with Maven installed.

### Endpoints

The application exposes the following endpoints:

The ports are set in the pom.xml file and exposed to the CLI in the cli-config.yml file.


### Notices

This project was generated using:
* generator-ibm-java v5.13.3
* generator-ibm-service-enablement v3.1.1
* generator-ibm-cloud-enablement v1.3.9
* generator-ibm-java-spring v

