FROM ibmjava:8-sdk

MAINTAINER IBM Java Engineering at IBM Cloud

RUN apt-get update && apt-get install -y maven

ENV PATH /project/target/liberty/wlp/bin/:$PATH

ARG bx_dev_user=root
ARG bx_dev_userid=1000
RUN BX_DEV_USER=$bx_dev_user
RUN BX_DEV_USERID=$bx_dev_userid
RUN if [ $bx_dev_user != "root" ]; then useradd -ms /bin/bash -u $bx_dev_userid $bx_dev_user; fi
