#!groovy
pipeline {
    agent {
        label "docker-build"
    }
    
    triggers {	
      issueCommentTrigger('trigger_build')	
    }

    options {
        timestamps()
        skipStagesAfterUnstable()
    }

    stages {
        stage('Build Docker images') {
            steps {
                withDockerRegistry([url: 'https://index.docker.io/v1/', credentialsId: 'docker.com-bot']) {
                    sh '''#!/usr/bin/env bash
                        echo "Starting build for Eclipse Codewind ..."
                        mvn -version
                        ./script/build.sh
                    '''
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
            
            steps {
                withDockerRegistry([url: 'https://index.docker.io/v1/', credentialsId: 'docker.com-bot']) {
                    sh '''#!/usr/bin/env bash
                        echo "Publishing docker images for Eclipse Codewind ..."
                        export REGISTRY="eclipse"
                        echo "Branch name is $GIT_BRANCH"

                        if [[ $GIT_BRANCH == "master" ]]; then
                            TAG="latest"
                        else
                            TAG=$GIT_BRANCH
                        fi        

                        # Publish docker images with a filter for branch name
                        # Acceptable branch names: master, start with '<number>.<number>'
                        if [[ $GIT_BRANCH == "master" ]] || [[ $GIT_BRANCH =~ ^([0-9]+\\.[0-9]+) ]]; then

                            declare -a DOCKER_IMAGE_ARRAY=("codewind-initialize-amd64" 
                                                        "codewind-performance-amd64" 
                                                        "codewind-pfe-amd64")

                            chmod u+x ./script/publish.sh

                            for i in "${DOCKER_IMAGE_ARRAY[@]}"
                            do
                                echo "Publishing $REGISTRY/$i:$TAG"
                                ./script/publish.sh $i $REGISTRY $TAG
                            done
                        else
                            echo "Skip publishing docker images for $GIT_BRANCH branch"
                        fi
                    '''
                }
             }
        } 
    }
}
