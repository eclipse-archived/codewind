/*******************************************************************************
* Copyright (c) 2019 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
*******************************************************************************/


/**
 * Return the translated string based on the supplied lang and id. 
 * If no key is found,  return the supplied defaultText instead.
 */
let TranslatedText = function (lang, id, defaultText) {
    if (!translations[lang] || !translations[lang][id]) {
        return defaultText;
    }
    return translations[lang][id];
}

const translations = {
    en: {
        'page.tests.title': 'Performance Testing',
        'page.tests.starttest': 'Run Load Test',
        'page.tests.managebtn': 'Manage results',
        'page.tests.charttitle': 'Charts',
        'page.tests.detailtitle': 'Detail',
        'page.tests.applyfilter': 'Apply Filter',
        'page.tests.clearfilter': 'Clear Filter',
        'page.tests.cpu': 'CPU',
        'page.tests.memory': 'Memory',
        'page.tests.http': 'Average Response time',
        'page.tests.hits': 'Hits',
        'page.tests.hitsfilter': 'Filter URLs',
        'page.tests.tooMany1': 'There are too many recorded entries to plot on this chart.',
        'page.tests.tooMany2': 'Use the filters link above and choose a subset of counters',
        'page.tests.addDesc': 'Add a test description',
        'page.tests.describe': 'Describe this new test',
        'btn.save': 'Save',
        'btn.cancel': 'Cancel',
        'btn.search': 'Search',
        'btn.filter': 'Filter',
        'btn.delete.loadtest': 'Delete',
        'page.tests.filterURLs': 'Choose which URLs to display',
        'page.tests.filterEndpoints': 'Filter URL Endpoints',
        'page.tests.nodata': 'Hey there friend! You need to run a test load before you can see any cool data.',
        'page.manage.title': 'Manage test results',
        "page.link.regressionTesting": 'Performance Testing',
        "page.link.manageResults": 'Manage results',
        "page.link.modifyParams": 'Modify configuration',
        "page.tests.delete.label": 'Delete Tests',
        "page.tests.delete.multidesc": "Hmm... are you sure you want to trash all these? You won't be able to surface this data again... as in forever.",
        "page.tests.delete.singledesc": "Hmm... are you sure you want to delete this test? You won't be able to surface this data again... as in forever.",
        "page.tests.delete.confirmDelete": "Yes, delete",
        "page.tests.delete.cancelDelete": "No, don't delete",
        "page.tests.delete.multi.label": "Multiple tests selected",
        "page.tests.delete.single.label": "Delete selected test",
        "page.tests.modifylabel": "Performance tests",
        "page.tests.modifyheading": "Modify load test configuration",
        "delete.modalheading.multi": "Multiple tests selected",
        "delete.modalheading.single": "Delete selected test"

    },
    de: {
        'page.tests.title': 'Leistungstest',
        'page.tests.starttest': 'Test starten',
        'page.tests.managebtn': 'Ergebnisse',
        'page.tests.charttitle': 'Diagramme',
        'page.tests.detailtitle': 'Detail',
        'page.tests.applyfilter': 'Apply Filter',
        'page.tests.clearfilter': 'Zeige alles',
        'page.tests.cpu': 'CPU',
        'page.tests.memory': 'Erinnerung',
        'page.tests.http': 'Durchschnittliche Antwortzeit',
        'page.tests.hits': 'Seitenaufrufe',
        'page.tests.hitsfilter': 'URLs filtern',
        'page.tests.tooMany1': 'Es sind zu viele aufgezeichnete Einträge vorhanden, um in diesem Diagramm dargestellt zu werden.',
        'page.tests.tooMany2': 'Verwenden Sie den Filter-Link oben und wählen Sie eine Teilmenge der Zähler aus',
        'page.tests.addDesc': 'Fügen Sie eine Testbeschreibung hinzu',
        'page.tests.describe': 'Beschreiben Sie diesen neuen Test',
        'btn.save': 'Sparen',
        'btn.cancel': 'Stornieren',
        'btn.search': 'Suche',
        'btn.filter': 'Filter',
        'btn.delete.loadtest': 'Test löschen',
        'page.tests.filterURLs': 'Wähle aus der Liste',
        'page.tests.filterEndpoints': 'Anfragen filtern',
        'page.tests.nodata': 'Hey da Freund! Sie müssen eine Testlast ausführen, bevor Sie coole Daten sehen können.',
        'page.manage.title': 'Testergebnisse verwalten',
        "page.link.regressionTesting": 'Leistungstest',
        "page.link.manageResults": 'Tests verwalten',
        "page.link.modifyParams": 'Konfiguration ändern',
        "page.tests.delete.label": 'Tests löschen',
        "page.tests.delete.multidesc": "Hmm ... Bist du sicher, dass du das alles wegwerfen willst? Sie werden diese Daten nicht wieder auftauchen können ... wie in Ewigkeit.",
        "page.tests.delete.singledesc": "Hmm ... Möchten Sie diesen Test wirklich löschen? Sie werden diese Daten nicht wieder auftauchen können ... wie in Ewigkeit.",
        "page.tests.delete.confirmDelete": "Ja, löschen",
        "page.tests.delete.cancelDelete": "Nein, nicht löschen",
        "page.tests.delete.multi.label": "Mehrere Tests ausgewählt",
        "page.tests.delete.single.label": "Ausgewählten Test löschen",
        "page.tests.modifylabel": "Leistungstests",
        "page.tests.modifyheading": "ÄndeÄndern Sie die Lasttestparameterrn",
        "delete.modalheading.multi": "Mehrere Tests ausgewählt",
        "delete.modalheading.single": "Ausgewählten Test löschen"
    },
    fr: {
        'page.tests.title': 'Test de performance',
        'page.tests.starttest': 'Lancer le test',
        'page.tests.managebtn': 'Résultats',
        'page.tests.charttitle': 'Graphiques',
        'page.tests.detailtitle': 'Détail',
        'page.tests.applyfilter': 'Apply Filter',
        'page.tests.clearfilter': 'Zeige alles',
        'page.tests.cpu': 'CPU',
        'page.tests.memory': 'Mémoire',
        'page.tests.http': 'Temps de réponse moyen',
        'page.tests.hits': 'Visites de page',
        'page.tests.hitsfilter': 'Filtrer les URL',
        'page.tests.tooMany1': "Il y a trop d'entrées enregistrées à tracer sur ce graphique.",
        'page.tests.tooMany2': 'Utilisez le lien filtres ci-dessus et choisissez un sous-ensemble de compteurs.',
        'page.tests.addDesc': 'Ajouter une description du test',
        'page.tests.describe': 'Décrivez ce nouveau test',
        'btn.save': 'Enregistrer',
        'btn.cancel': 'Annuler',
        'btn.search': 'Chercher',
        'btn.filter': 'Filter',
        'btn.delete.loadtest': 'Supprimer le test',
        'page.tests.filterURLs': 'Choisissez dans la liste',
        'page.tests.filterEndpoints': 'Filtrer les demandes',
        'page.tests.nodata': 'Salut mon ami! Vous devez exécuter une charge de test avant de pouvoir voir des données intéressantes.',
        'page.manage.title': 'Gérer les résultats du test',
        "page.link.regressionTesting": 'Test de performance',
        "page.link.manageResults": 'Gérer les résultats',
        "page.link.modifyParams": 'Modifier la configuration',
        "page.tests.delete.label": 'Supprimer les tests',
        "page.tests.delete.multidesc": "Hmm ... êtes-vous sûr de vouloir éliminer tout cela? Vous ne pourrez plus afficher ces données ... comme pour toujours.",
        "page.tests.delete.singledesc": "Hmm ... êtes-vous sûr de vouloir supprimer ce test? Vous ne pourrez plus afficher ces données ... comme pour toujours.",
        "page.tests.delete.confirmDelete": "Oui, supprimer",
        "page.tests.delete.cancelDelete": "Non, ne pas supprimer",
        "page.tests.delete.multi.label": "Plusieurs tests sélectionnés",
        "page.tests.delete.single.label": "Supprimer le test sélectionné",
        "page.tests.modifylabel": "Des tests de performance",
        "page.tests.modifyheading": "Modifier les paramètres de test de charge",
        "delete.modalheading.multi": "Plusieurs tests sélectionnés",
        "delete.modalheading.single": "Supprimer le test sélectionné"
    }
}

exports.TranslatedText = TranslatedText;
