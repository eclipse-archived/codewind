################################################################################
# Copyright (c) 2019 IBM Corporation and others.
# All rights reserved. This program and the accompanying materials
# are made available under the terms of the Eclipse Public License v2.0
# which accompanies this distribution, and is available at
# http://www.eclipse.org/legal/epl-v20.html
#
# Contributors:
#     IBM Corporation - initial API and implementation
################################################################################

FROM jboss/keycloak:8.0.0
LABEL org.opencontainers.image.title="Codewind-Keycloak" org.opencontainers.image.description="Codewind Keycloak" \
      org.opencontainers.image.url="https://codewind.dev/" \
      org.opencontainers.image.source="https://github.com/eclipse/codewind"

# Copy our license files into the new image
COPY LICENSE NOTICE.md ./

COPY ./theme/  /opt/jboss/keycloak/themes/
EXPOSE 8080 8443