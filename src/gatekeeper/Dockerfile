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

FROM node:12-alpine

EXPOSE 9096 9496

RUN apk add --no-cache --update openssl

# Create UI app directory and install source code
WORKDIR /usr/src/app
COPY . .

# Install dependancies
RUN npm ci --production

# Run as the default node user from the image rather than root.
USER 1000
CMD [ "npm", "start" ]