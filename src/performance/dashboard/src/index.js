/*******************************************************************************
* Copyright (c) 2019 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
******************************************************************************/

import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { Provider } from 'react-redux';
import configureStore from './store/store';
import Keycloak from 'keycloak-js'
import * as AppConstants from './AppConstants';

// fetch the authentication details from gatekeeper
async function fetchAuthInfo() {
    try {
        const result = await fetch(`${AppConstants.API_SERVER}/api/v1/gatekeeper/environment`, {
            method: 'get',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        const reply = await result.json();
        if (result.status == 200) {
            return {
                url: reply.auth_url + "/auth",
                realm: reply.realm,
                clientId: reply.client_id,
                onLoad: 'login-required'
            }
        }
        return { hasError: true, status: result.status };
    } catch (err) {
        return { hasError: true, status: 500, message: err }
    }
}


async function init() {
    let initOptions = await fetchAuthInfo();
    if (initOptions.hasError) {
        console.warn("No Auth service available")
        ReactDOM.render(
            <Provider store={configureStore}>
                <App />
            </Provider>
            , document.getElementById('root')
        );
    } else {
        let keycloak = Keycloak(initOptions)
        keycloak.init({ onLoad: initOptions.onLoad }).success((auth) => {
            if (!auth) {
                window.location.reload();
            } else {
                console.info(`Dashboard - authenticated`);
            }
            ReactDOM.render(
                <Provider store={configureStore}>
                    <App />
                </Provider>
                , document.getElementById('root'));

            localStorage.setItem("cw-access-token", keycloak.token);
            localStorage.setItem("cw-refresh-token", keycloak.refreshToken);

            // Access token refresh
            setTimeout(() => {
                // if the access token is due to expire within the next 80 seconds refresh it
                keycloak.updateToken(80).success((refreshed) => {
                    if (refreshed) {
                        console.debug(`Dashboard access-token refreshed`);
                    } else {
                        console.warn(`Dashboard refresh-token refreshed`);
                    }
                }).error(() => {
                    console.error(`Dashboard Failed to refresh authentication tokens`);
                });
            }, 60 * 1000)

        }).error(err => {
            console.error("Authenticated Failed");
            console.error(err);
        });
    }
}

init();