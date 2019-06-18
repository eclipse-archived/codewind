# FROM websphere-liberty:19.0.0.3-webProfile7
FROM websphere-liberty@sha256:e99527c9275af659208e8ee28c9935f2f6c88cf24cf1819558578d8ddbcad112
LABEL maintainer="IBM Java Engineering at IBM Cloud"
COPY /target/liberty/wlp/usr/servers/defaultServer /config/
COPY /target/liberty/wlp/usr/shared/resources /config/resources/
COPY /src/main/liberty/config/jvmbx.options /config/jvm.options
# Grant write access to apps folder, this is to support old and new docker versions.
# Liberty document reference : https://hub.docker.com/_/websphere-liberty/
USER root
RUN chmod g+w /config/apps
USER 1001
# install any missing features required by server config
RUN installUtility install --acceptLicense defaultServer

# Upgrade to production license if URL to JAR provided
ARG LICENSE_JAR_URL
RUN \ 
  if [ $LICENSE_JAR_URL ]; then \
    wget $LICENSE_JAR_URL -O /tmp/license.jar \
    && java -jar /tmp/license.jar -acceptLicense /opt/ibm \
    && rm /tmp/license.jar; \
  fi
