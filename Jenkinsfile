#!groovy

import java.text.SimpleDateFormat;

@NonCPS
def getChangeDetail() {

    def changeDetail = ""
    def changes = currentBuild.changeSets
    
    for (int i = 0; i < changes.size(); i++) {
        
        def entries = changes[i].items
    
        for (int j = 0; j < entries.length; j++) {
            def entry = entries[j]

            Date entry_timestamp = new Date(entry.timestamp)
            SimpleDateFormat timestamp = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
            changeDetail += "${entry.commitId.take(7)} by [${entry.author}] on ${timestamp.format(entry_timestamp)}: ${entry.msg}\n\n"
        }
    }

    if (!changeDetail) {
        changeDetail = "No new changes"
    }
    return changeDetail
}

IS_MASTER_BRANCH = env.BRANCH_NAME == "master"
IS_RELEASE_BRANCH = (env.BRANCH_NAME ==~ /\d+\.\d+\.\d+/)

def sendEmailNotification() {    
    if (!(IS_MASTER_BRANCH || IS_RELEASE_BRANCH)) {
        println "Skipping email step since branch condition was not met"
        return
    }

    final def EXTRECIPIENTS = emailextrecipients([
        [$class: 'CulpritsRecipientProvider'],
        [$class: 'RequesterRecipientProvider'],
        [$class: 'DevelopersRecipientProvider']
    ])

    def RECIPIENTS = EXTRECIPIENTS != null ? EXTRECIPIENTS : env.CHANGE_AUTHOR_EMAIL;
    def SUBJECT = "${env.JOB_NAME} - Build #${env.BUILD_NUMBER} - ${currentBuild.currentResult}!"
    def CHANGE = getChangeDetail();
    
    emailext(
        to: RECIPIENTS,
        subject: "${SUBJECT}",
        body: """
            <b>Build result:</b> 
            <br><br>
            ${currentBuild.currentResult}
            <br><br>
            <b>Project name - Build number:</b>
            <br><br>
            ${currentBuild.fullProjectName} - Build #${env.BUILD_NUMBER}
            <br><br>
            <b>Check console output for more detail:</b> 
            <br><br>
            <a href="${currentBuild.absoluteUrl}console">${currentBuild.absoluteUrl}console</a>
            <br><br>
            <b>Changes:</b> 
            <br><br>
            ${CHANGE}
            <br><br>
        """
    );
}

pipeline {
    agent {
        label "docker-build"
    }
    
    triggers {	
      issueCommentTrigger('trigger_build')
      upstream(upstreamProjects: "Codewind/codewind-odo-extension/${env.BRANCH_NAME},Codewind/codewind-appsody-extension/${env.BRANCH_NAME}", threshold: hudson.model.Result.SUCCESS)
    }

    options {
        quietPeriod(300)
        timestamps()
        skipStagesAfterUnstable()
    }

    environment {
        CODECOV_TOKEN = credentials('codecov-token-codewind-repository')
        INSECURE_KEYRING = 'true'
    }

    stages {
        stage('Run Portal eslint and unit tests') {
            options {
                timeout(time: 30, unit: 'MINUTES') 
            }
            steps {
                withEnv(["PATH=$PATH:~/.local/bin;NOBUILD=true"]) {
                    sh '''#!/usr/bin/env bash
                        DIR=`pwd`;

                        echo "Starting unit tests for Portal..."
                        export PATH=$PATH:/home/jenkins/.jenkins/tools/jenkins.plugins.nodejs.tools.NodeJSInstallation/node_js/bin/

                        # Install nvm to easily set version of node to use
                        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
                        export NVM_DIR="$HOME/.nvm" 
                        . $NVM_DIR/nvm.sh
                        nvm i 10
                        
                        # Run eslint on portal code
                        cd $DIR/src/pfe/portal
                        npm install
                        if [ $? -ne 0 ]; then
                            exit 1
                        fi

                        npm run eslint
                        if [ $? -ne 0 ]; then
                            exit 1
                        fi

                        # Run eslint on portal tests
                        cd $DIR/test
                        npm install
                        if [ $? -ne 0 ]; then
                            exit 1
                        fi

                        npm run eslint
                        if [ $? -ne 0 ]; then
                            exit 1
                        fi
                            
                        # Run the unit test suite
                        echo "Portal unit tests"

                        npm run unittest
                        if [ $? -eq 0 ]; then
                            echo "+++   PORTAL UNIT TESTS COMPLETED SUCCESSFULLY   +++";
                        else
                            echo "+++   PORTAL UNIT TESTS FAILED   +++";
                            exit 1;
                        fi
                        '''
                }
            }
        }

        stage('Run Turbine unit test suite') {
            options {
                timeout(time: 30, unit: 'MINUTES')
            }
            steps {
                withEnv(["PATH=$PATH:~/.local/bin;NOBUILD=true"]) {
                    withDockerRegistry([url: 'https://index.docker.io/v1/', credentialsId: 'docker.com-bot']) {
                        sh '''#!/usr/bin/env bash
                        DIR=`pwd`;
                        echo "Starting unit tests for Turbine..."
                        export PATH=$PATH:/home/jenkins/.jenkins/tools/jenkins.plugins.nodejs.tools.NodeJSInstallation/node_js/bin/
                        
                        ARCH=`uname -m`;
                        printf "\n\n${MAGENTA}Platform: $ARCH ${RESET}\n"

                        # Install nvm to easily set version of node to use
                        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
                        export NVM_DIR="$HOME/.nvm" 
                        . $NVM_DIR/nvm.sh
                        nvm i 10
                        
                        # Run eslint on turbine code
                        cd $DIR/src/pfe/file-watcher/server
                        npm install
                        
                        if [ $? -ne 0 ]; then
                            exit 1
                        fi
                            
                        # Run the unit test suite
                        echo "Started running Turbine Unit Test Suite"
                        npm run unit:test
                        if [ $? -eq 0 ]; then
                            echo "+++   TURBINE UNIT TESTS COMPLETED SUCCESSFULLY   +++";
                        else
                            echo "+++   TURBINE UNIT TESTS FAILED   +++";
                            exit 1;
                        fi
                        '''
                    }
                }
            }
        }

        stage('Build Docker images') {
            steps {
                withDockerRegistry([url: 'https://index.docker.io/v1/', credentialsId: 'docker.com-bot']) {
                    
                    // NOTE: change of this sh call should be in sync with './script/build.sh'. 
                    sh '''#!/usr/bin/env bash
                        # Docker system prune
                        echo "Docker system prune ..."
                        docker system df
                        docker system prune -a --volumes -f
                        docker builder prune -a -f
                        docker system df
                        df -lh

                        echo "Starting build for Eclipse Codewind ..."
                        
                        DIR=`pwd`;
                        SRC_DIR=$DIR/src;
                        PFE=pfe
                        PERFORMANCE=performance;
                        KEYCLOAK=keycloak;
                        GATEKEEPER=gatekeeper;
                        ARCH=`uname -m`;
                        TAG=latest;
                        REGISTRY=eclipse

                        # On intel, uname -m returns "x86_64", but the convention for our docker images is "amd64"
                        if [ "$ARCH" == "x86_64" ]; then
                            IMAGE_ARCH="amd64"
                        else
                            IMAGE_ARCH=$ARCH
                        fi

                        ALL_IMAGES="$PFE $PERFORMANCE $KEYCLOAK $GATEKEEPER";

                        # Copy .env over to file-watcher
                        if [ -f $DIR/.env ]; then
                            echo -e "\nCopying $DIR/.env to ${SRC_DIR}/${PFE}/file-watcher/scripts/.env\n"
                            cp $DIR/.env ${SRC_DIR}/${PFE}/file-watcher/scripts/.env
                        fi

                        # Copy the license files to the portal, performance, keycloak and gatekeeper 
                        cp -r $DIR/LICENSE ${SRC_DIR}/pfe/portal/
                        cp -r $DIR/NOTICE.md ${SRC_DIR}/pfe/portal/
                        cp -r $DIR/LICENSE ${SRC_DIR}/performance/
                        cp -r $DIR/NOTICE.md ${SRC_DIR}/performance/
                        cp -r $DIR/LICENSE ${SRC_DIR}/keycloak/
                        cp -r $DIR/NOTICE.md ${SRC_DIR}/keycloak/
                        cp -r $DIR/LICENSE ${SRC_DIR}/gatekeeper/
                        cp -r $DIR/NOTICE.md ${SRC_DIR}/gatekeeper/
                        
                        # Copy the docs into portal
                        cp -r $DIR/docs ${SRC_DIR}/pfe/portal/

                        echo -e "\n+++   DOWNLOADING EXTENSIONS   +++\n";

                        # If CHANGE_TARGET is set then this is a PR so use the target branch (usually master)
                        VERSION=""
                        BRANCH=""
                        if [ -z "$CHANGE_TARGET" ]; then
                             BRANCH=$GIT_BRANCH
                            if [ $GIT_BRANCH == "master" ]; then
                                VERSION="9.9.9999"
                            else
                                VERSION="$GIT_BRANCH"
                            fi
                        else
                            BRANCH=$CHANGE_TARGET
                            if [ $CHANGE_TARGET == "master" ]; then
                                VERSION="9.9.9999"
                            else
                                VERSION="$CHANGE_TARGET"
                            fi
                        fi

                        echo "extension version to be downloaded: $VERSION"
                        echo "extension branch to be used: $BRANCH"

                        mkdir -p ${SRC_DIR}/pfe/extensions
                        rm -f ${SRC_DIR}/pfe/extensions/codewind-appsody-extension-*.zip
                        rm -f ${SRC_DIR}/pfe/extensions/codewind-odo-extension-*.zip
                        rm -f ${SRC_DIR}/pfe/extensions/codewind-odo-devfile-extension-*.zip

                        curl -Lfo ${SRC_DIR}/pfe/extensions/codewind-appsody-extension-$VERSION.zip http://archive.eclipse.org/codewind/codewind-appsody-extension/$BRANCH/latest/codewind-appsody-extension-$VERSION.zip
                        if [ $? -ne 0 ]; then
                            echo "Error downloading appsody extension"
                            exit 1
                        fi

                        curl -Lfo ${SRC_DIR}/pfe/extensions/codewind-odo-extension-$VERSION.zip http://archive.eclipse.org/codewind/codewind-odo-extension/$BRANCH/latest/codewind-odo-extension-$VERSION.zip
                        if [ $? -ne 0 ]; then
                            echo "Error downloading odo extension"
                            exit 1
                        fi

                        ODO_DEVFILE_BRANCH="master-devfile"
                        ODO_DEVFILE_VERSION="9.9.9999"
                        curl -Lfo ${SRC_DIR}/pfe/extensions/codewind-odo-extension-devfile-$VERSION.zip http://archive.eclipse.org/codewind/codewind-odo-extension/$ODO_DEVFILE_BRANCH/latest/codewind-odo-extension-devfile-$ODO_DEVFILE_VERSION.zip
                        if [ $? -ne 0 ]; then
                            echo "Error downloading odo-devfile extension"
                            exit 1
                        fi

                        # BUILD IMAGES
                        # Uses a build file in each of the directories that we want to use
                        echo -e "\n+++   BUILDING DOCKER IMAGES   +++\n";

                        for image in $ALL_IMAGES
                        do
                            export IMAGE_NAME=codewind-$image-$IMAGE_ARCH
                            echo Building image $IMAGE_NAME;
                            cd ${SRC_DIR}/${image};
                            time sh build Dockerfile_${ARCH};

                            if [ $? -eq 0 ]; then
                                echo "+++   SUCCESSFULLY BUILT $IMAGE_NAME   +++";

                                echo -e "\n+++   RETAGGING $IMAGE_NAME TO HAVE TAG:':test' FOR TEST ONLY MODIFICATIONS +++\n";
                                # Allows us to modify the Docker images for test only modifications
                                # Such as telling PFE to run with Code Coverage generation enabled 
                                # The original image (latest) will be the one that is pushed to Dockerhub

                                if [ "$image" = "$PFE" ]; then
                                    # Now overwrite the PFE image ':test' tag with new changes
                                    echo -e "FROM eclipse/codewind-pfe-amd64:latest\nENV ENABLE_CODE_COVERAGE=true" >> pfe-test-dockerfile
                                    docker build -t eclipse/codewind-pfe-amd64:test -f pfe-test-dockerfile .
                                    rm pfe-test-dockerfile
                                else
                                    docker tag eclipse/codewind-${image}-${IMAGE_ARCH}:latest eclipse/codewind-${image}-${IMAGE_ARCH}:test
                                fi

                            else
                                echo "+++   FAILED TO BUILD $IMAGE_NAME - exiting.   +++";
                                exit 12;
                            fi
                        done;
                        echo -e "\n+++   ALL DOCKER IMAGES SUCCESSFULLY BUILT   +++\n";
                        docker images | grep codewind;
                    '''
                }
            }
        }
        
        stage('Start Codewind and run the API tests') {  
            options {
                timeout(time: 2, unit: 'HOURS') 
            }   
            steps {
                withEnv(["PATH=$PATH:~/.local/bin;NOBUILD=true"]){
                    withDockerRegistry([url: 'https://index.docker.io/v1/', credentialsId: 'docker.com-bot']) {
                        sh '''#!/usr/bin/env bash
                        echo "Starting tests for Eclipse Codewind ..."
                        export PATH=$PATH:/home/jenkins/.jenkins/tools/jenkins.plugins.nodejs.tools.NodeJSInstallation/node_js/bin/
                        mkdir -p $HOME/dc
                        export PATH=$PATH:$HOME/dc/
                        ARCH=`uname -m`;
                        printf "\n\n${MAGENTA}Platform: $ARCH ${RESET}\n"
                        DIR=`pwd`;

                        # Install nvm to easily set version of node to use
                        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
                        export NVM_DIR="$HOME/.nvm" 
                        . $NVM_DIR/nvm.sh
                        nvm i 10
                        
                        # Install docker-compose
                        curl -L https://github.com/docker/compose/releases/download/1.21.2/docker-compose-`uname -s`-`uname -m` -o $HOME/dc/docker-compose
                        if [ $? -ne 0 ]; then
                            echo "Error downloading docker-compose"
                            exit 1
                        fi
                        chmod +x $HOME/dc/docker-compose

                        # Create codewind-workspace if it does not exist
                        printf "\n\nCreating codewind-workspace\n"
                        mkdir -m 777 -p $DIR/codewind-workspace

                        # Save Docker image ID of PFE to ensure we're not using the image from Dockerhub
                        BUILT_PFE_IMAGE_ID=$(docker images --filter=reference=eclipse/codewind-pfe-amd64:latest --format "{{.ID}}")
                        echo "PFE Image: $BUILT_PFE_IMAGE_ID"

                        # Set image tag to test
                        export CWCTL_IMAGE_TAG=test

                        # If CHANGE_TARGET is set then this is a PR so use the target branch (usually master)
                        if [ -z "$CHANGE_TARGET" ]; then
                            export CW_CLI_BRANCH=$GIT_BRANCH
                        else
                            export CW_CLI_BRANCH=$CHANGE_TARGET
                        fi

                        echo "cwctl branch to be used: $CW_CLI_BRANCH"

                        # Start Codewind
                        sh $DIR/start.sh
                        if [ $? -ne 0 ]; then
                            echo "Error starting Codewind"
                            exit 1
                        fi

                        # Check that cwctl has not pulled down a new PFE image
                        POST_START_IMAGE_ID=$(docker images --filter=reference=eclipse/codewind-pfe-amd64:latest --format "{{.ID}}")
                        echo "PFE Container image: $POST_START_IMAGE_ID"
                        if [ "$BUILT_PFE_IMAGE_ID" != "$POST_START_IMAGE_ID" ]; then
                            echo "Error a new PFE image has been downloaded"
                            echo "Built PFE image ID: $BUILT_PFE_IMAGE_ID"
                            echo "Downloaded PFE image ID: $POST_START_IMAGE_ID"
                            echo "Docker images"
                            docker images
                            echo "Docker ps"
                            docker ps
                            exit 1
                        fi

                        # Run the API tests now Portal has started
                        cd $DIR/test/
                        npm install 
                        if [ $? -ne 0 ]; then
                            exit 1
                        fi

                        npm run apitest
                        if [ $? -ne 0 ]; then
                            exit 1
                        fi
                        '''
                    }
                }
            }
        } 

        stage('Output Code Coverage for PFE (Portal API and Unit tests, File-watcher Unit tests only)') {
            options {
                timeout(time: 30, unit: 'MINUTES')
            }
            steps {
                withEnv(["PATH=$PATH:~/.local/bin;NOBUILD=true"]) {
                    withDockerRegistry([url: 'https://index.docker.io/v1/', credentialsId: 'docker.com-bot']) {
                        sh '''#!/usr/bin/env bash
                            DIR=`pwd`;
                            export PATH=$PATH:/home/jenkins/.jenkins/tools/jenkins.plugins.nodejs.tools.NodeJSInstallation/node_js/bin/

                            # Install nvm to easily set version of node to use
                            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
                            export NVM_DIR="$HOME/.nvm" 
                            . $NVM_DIR/nvm.sh
                            nvm i 10

                            docker image inspect eclipse/codewind-pfe-amd64:test -f '{{.Config.Env}}' | grep ENABLE_CODE_COVERAGE=true
                            if [ $? -eq 0 ]; then
                                echo "Code coverage enabled in eclipse/codewind-pfe-amd64:test (image)"
                            fi

                            docker inspect -f '{{.Config.Env}}' codewind-pfe | grep ENABLE_CODE_COVERAGE=true
                            if [ $? -eq 0 ]; then
                                echo "Code coverage enabled in codewind-pfe (container)"
                            fi

                            CODECOV_ENABLED=true FW_COVERAGE_ENABLED=true node $DIR/test/scripts/generate_complete_coverage.js
                            '''
                    }
                }
            }
        }
        
        stage('Publish Docker images') {

            // This when clause disables PR build uploads; you may comment this out if you want your build uploaded.
            when {
                beforeAgent true
                not {
                    changeRequest()
                }
            }
            options {
                timeout(time: 30, unit: 'MINUTES') 
                retry(3)
            }   
            steps {
                withDockerRegistry([url: 'https://index.docker.io/v1/', credentialsId: 'docker.com-bot']) {
                    sh '''#!/usr/bin/env bash
                        echo "Publishing docker images for Eclipse Codewind ..."
                        echo "Branch name is $GIT_BRANCH"

                        if [[ $GIT_BRANCH == "master" ]]; then
                            TAG="latest"
                        else
                            TAG=$GIT_BRANCH
                        fi        

                        # Publish docker images with a filter for branch name
                        # Acceptable branch names: master, start with '<number>.<number>'
                        if [[ $GIT_BRANCH == "master" ]] || [[ $GIT_BRANCH =~ ^([0-9]+\\.[0-9]+) ]]; then

                            declare -a DOCKER_IMAGE_ARRAY=("eclipse/codewind-performance-amd64" 
                                                        "eclipse/codewind-pfe-amd64" 
                                                        "eclipse/codewind-keycloak-amd64"
                                                        "eclipse/codewind-gatekeeper-amd64")

                            for i in "${DOCKER_IMAGE_ARRAY[@]}"
                            do
                                if [[ $GIT_BRANCH =~ ^([0-9]+\\.[0-9]+) ]]; then
                                    docker tag $i $i:${TAG:-latest}
                                fi
                                echo "Publishing $i:$TAG"
                                docker push $i:${TAG:-latest}
                            done

                            if [[ $GIT_BRANCH =~ ^([0-9]+\\.[0-9]+) ]]; then
                                IFS='.' # set '.' as delimiter
                                read -ra TOKENS <<< "$GIT_BRANCH"    
                                IFS=' ' # reset delimiter
                                export TAG_CUMULATIVE=${TOKENS[0]}.${TOKENS[1]}

                                for i in "${DOCKER_IMAGE_ARRAY[@]}"
                                do
                                    docker tag $i $i:${TAG_CUMULATIVE:-latest}
                                    echo "Publishing $i:$TAG_CUMULATIVE"
                                    docker push $i:${TAG_CUMULATIVE:-latest}
                                done
                            fi
                        else
                            echo "Skip publishing docker images for $GIT_BRANCH branch"
                        fi
                    '''
                }
             }
        } 
    }

    post {
        always {
           sh '''#!/usr/bin/env bash
  
              # Output portal logs
              printf "\n********** codewind-pfe logs **********\n\n"
              docker logs codewind-pfe

              # Shutdown and cleanup.
              printf "\nStopping and removing Codewind Docker containers.\n"
              DOCKER_PS="docker ps -a -q  --filter name=codewind";
              DOCKER_IMAGES="docker images -q --filter reference=codewind*";

              DOCKER_PS_APPS="docker ps -a -q  --filter name=cw";
              DOCKER_IMAGES_APPS="docker images -q --filter reference=cw*";

              # Check to make sure that there are actually proceses to remove
              NUMBER_OF_PROCESSES=$($DOCKER_PS | wc -l)
              if [ $NUMBER_OF_PROCESSES -gt 0 ]; then
                # Removing containers

                printf "\nStopping all running containers\n";

                docker rm -f $($DOCKER_PS)
                if [ $? -eq 0 ]; then
                    printf "\nSuccessfully removed containers\n";
                else
                    printf "\nError removing containers\n";
                    exit;
                fi
                printf "\nSUCCESSFULLY REMOVED CONTAINERS\n";
              else
                printf "\nERROR: THERE ARE NO CONTAINERS TO REMOVE\n";
              fi

              # Check to make sure that there are actually proceses to remove
              NUMBER_OF_PROCESSES=$($DOCKER_PS_APPS | wc -l)
              if [ $NUMBER_OF_PROCESSES -gt 0 ]; then
                # Removing containers
                docker rm -f $($DOCKER_PS_APPS)
                if [ $? -eq 0 ]; then
                    printf "\n${GREEN}Successfully removed containers $RESET\n";
                else
                    printf "\n${RED}Error removing containers $RESET\n";
                    exit;
                fi
                printf "\n${GREEN}SUCCESSFULLY REMOVED CONTAINERS $RESET\n";
              else
                printf "\n${RED}ERROR: THERE ARE NO CONTAINERS TO REMOVE $RESET\n";
              fi

              # Remove the codewind network
              printf "\nRemoving docker network\n";
              docker network rm codewind_network
              if [ $? -eq 0 ]; then
                  printf "\n${GREEN}Successfully removed docker network $RESET\n";
              else
                  printf "\n${RED}Error removing docker network $RESET\n";
              fi

              # Remove the default network
              printf "\nRemoving docker network\n";
              docker network rm codewind_default
              if [ $? -eq 0 ]; then
                  printf "\n${GREEN}Successfully removed docker network $RESET\n";
              else
                  printf "\n${RED}Error removing docker network $RESET\n";
              fi

              # Docker system prune
              echo "Docker system prune ..."
              docker system df
              docker system prune -a --volumes -f
              docker builder prune -a -f
              docker system df
              df -lh

              # Remove docker-compose
              echo "Removing docker-compose"
              rm -rf $HOME/dc
            '''
            echo 'Clean up workspace'
            deleteDir() /* clean up our workspace */
        }
        failure {
            sendEmailNotification()
        }
    }
}
