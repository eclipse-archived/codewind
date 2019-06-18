@echo off
REM #*******************************************************************************
REM # Copyright (c) 2019 IBM Corporation and others.
REM # All rights reserved. This program and the accompanying materials
REM # are made available under the terms of the Eclipse Public License v2.0
REM # which accompanies this distribution, and is available at
REM # http://www.eclipse.org/legal/epl-v20.html
REM #
REM # Contributors:
REM #     IBM Corporation - initial API and implementation
REM #*******************************************************************************

for %%a in (.) do SET APP_NAME=%%~na

SET IDC_INSTALL_DIR=%~dp0.

if %1 == shell (
	for /f %%i in ('java.exe -jar %IDC_INSTALL_DIR%\artifacts\IDC.jar appid') do set APP_ID=%%i
	echo APP_ID: %APP_ID%

	docker exec -it iterative-dev-%APP_NAME%-%APP_ID% bash
	GOTO :EOF
)

java.exe -jar %IDC_INSTALL_DIR%\artifacts\IDC.jar %* --idcLocalOS=windows --idcWinPath=%IDC_INSTALL_DIR%