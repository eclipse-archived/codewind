FROM ibmcom/swift-ubuntu-runtime:4.1.1
LABEL maintainer="IBM Swift Engineering at IBM Cloud"
LABEL Description="Template Dockerfile that extends the ibmcom/swift-ubuntu-runtime image."

RUN apt-get update \
&& apt-get install -y curl \
&& rm -rf /var/lib/apt/lists/*

# We can replace this port with what the user wants
EXPOSE 8080

# Default user if not provided
ARG bx_dev_user=root
ARG bx_dev_userid=1000

# Install system level packages
# RUN apt-get update && apt-get dist-upgrade -y

# Add utils files
RUN mkdir /swift-utils \
&& curl -sL https://raw.githubusercontent.com/IBM-Swift/swift-ubuntu-docker/master/utils/run-utils.sh -o /swift-utils/run-utils.sh \
&& curl -sL https://raw.githubusercontent.com/IBM-Swift/swift-ubuntu-docker/master/utils/common-utils.sh -o /swift-utils/common-utils.sh \
&& chmod -R 555 /swift-utils

# Create user if not root
RUN if [ $bx_dev_user != "root" ]; then useradd -ms /bin/bash -u $bx_dev_userid $bx_dev_user; fi

# Bundle application source & binaries
COPY . /swift-project

# Command to start Swift application
CMD [ "sh", "-c", "cd /swift-project && .build-ubuntu/release/microclimatetestswift" ]
