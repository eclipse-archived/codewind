#!groovy​

pipeline {
    agent any 
	options {
        timestamps()
        skipStagesAfterUnstable()
    }

    stages {
    	stage('Build Docker image') {
            agent {
                label "docker-build"
            }
            steps {
				sh '''#!/usr/bin/env bash
					echo "Starting build for Eclipse Codewind ..."
					sh './script/build.sh'
				'''
            }
        }
    }
}
