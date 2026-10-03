/*
 * Shared IndexedDB repository foundation.
 * Page migrations are intentionally separate from this module.
 */

const FACULTY_DB_NAME = "FacultyManagementDB";
const FACULTY_DB_VERSION = 3;

const FACULTY_STORE_DEFINITIONS = {
    notes: {
        keyPath: "id",
        autoIncrement: true,
        indexes: {
            category: "category"
        }
    },
    subjects: {
        keyPath: "id",
        autoIncrement: true,
        indexes: {
            code: "code",
            section: "section",
            updatedAt: "updatedAt"
        }
    },
    pendingWorks: {
        keyPath: "id",
        autoIncrement: true,
        indexes: {
            status: "status",
            priority: "priority",
            deadline: "deadline",
            updatedAt: "updatedAt"
        }
    },
    timetable: {
        keyPath: "id",
        autoIncrement: false,
        indexes: {}
    },
    documents: {
        keyPath: "id",
        autoIncrement: true,
        indexes: {
            category: "category",
            date: "date",
            updatedAt: "updatedAt"
        }
    },
    certificates: {
        keyPath: "id",
        autoIncrement: true,
        indexes: {
            category: "category",
            date: "date",
            updatedAt: "updatedAt"
        }
    },
    files: {
        keyPath: "id",
        autoIncrement: true,
        indexes: {}
    },
    metadata: {
        keyPath: "key",
        autoIncrement: false,
        indexes: {}
    }
};

let facultyDatabasePromise = null;

function createFacultyStore(database, transaction, storeName, definition) {
    let store;

    if (database.objectStoreNames.contains(storeName)) {
        store = transaction.objectStore(storeName);
    } else {
        store = database.createObjectStore(storeName, {
            keyPath: definition.keyPath,
            autoIncrement: definition.autoIncrement
        });
    }

    Object.entries(definition.indexes).forEach(([indexName, keyPath]) => {
        if (!store.indexNames.contains(indexName)) {
            store.createIndex(indexName, keyPath, { unique: false });
        }
    });

    return store;
}

function openFacultyDatabase() {
    if (facultyDatabasePromise) {
        return facultyDatabasePromise;
    }

    facultyDatabasePromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error("IndexedDB is not available in this browser."));
            return;
        }

        const request = window.indexedDB.open(
            FACULTY_DB_NAME,
            FACULTY_DB_VERSION
        );

        request.onupgradeneeded = event => {
            const database = event.target.result;
            const transaction = event.target.transaction;

            Object.entries(FACULTY_STORE_DEFINITIONS).forEach(
                ([storeName, definition]) => {
                    createFacultyStore(
                        database,
                        transaction,
                        storeName,
                        definition
                    );
                }
            );
        };

        request.onsuccess = event => {
            const database = event.target.result;

            database.onversionchange = () => {
                database.close();
                facultyDatabasePromise = null;
            };

            resolve(database);
        };

        request.onerror = () => {
            facultyDatabasePromise = null;
            reject(
                request.error ||
                    new Error("Unable to open the Faculty Management database.")
            );
        };

        request.onblocked = () => {
            facultyDatabasePromise = null;
            reject(
                new Error(
                    "The Faculty Management database upgrade is blocked by another open connection."
                )
            );
        };
    });

    return facultyDatabasePromise;
}

function runFacultyTransaction(storeName, mode, operation) {
    return openFacultyDatabase().then(
        database =>
            new Promise((resolve, reject) => {
                let transaction;

                try {
                    transaction = database.transaction(storeName, mode);
                    const store = transaction.objectStore(storeName);
                    operation(store, resolve, reject);
                } catch (error) {
                    reject(error);
                }

                if (transaction) {
                    transaction.onerror = () => {
                        reject(
                            transaction.error ||
                                new Error(
                                    `IndexedDB transaction failed for ${storeName}.`
                                )
                        );
                    };
                }
            })
    );
}

function getFacultyRecord(storeName, key) {
    return runFacultyTransaction(storeName, "readonly", (store, resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getAllFacultyRecords(storeName) {
    return runFacultyTransaction(storeName, "readonly", (store, resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function addFacultyRecord(storeName, record) {
    return runFacultyTransaction(storeName, "readwrite", (store, resolve, reject) => {
        const request = store.add(record);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function updateFacultyRecord(storeName, record) {
    return runFacultyTransaction(storeName, "readwrite", (store, resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deleteFacultyRecord(storeName, key) {
    return runFacultyTransaction(storeName, "readwrite", (store, resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function clearFacultyStore(storeName) {
    return runFacultyTransaction(storeName, "readwrite", (store, resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function saveFacultyFile(fileRecord) {
    if (!(fileRecord && fileRecord.blob instanceof Blob)) {
        return Promise.reject(new TypeError("fileRecord.blob must be a Blob."));
    }

    return addFacultyRecord("files", fileRecord);
}

function getFacultyFile(fileId) {
    return getFacultyRecord("files", fileId);
}

function deleteFacultyFile(fileId) {
    return deleteFacultyRecord("files", fileId);
}

function saveFacultyMetadata(key, value) {
    return updateFacultyRecord("metadata", { key, value });
}

function getFacultyMetadata(key) {
    return getFacultyRecord("metadata", key);
}

function deleteFacultyMetadata(key) {
    return deleteFacultyRecord("metadata", key);
}

const FacultyStorage = Object.freeze({
    databaseName: FACULTY_DB_NAME,
    databaseVersion: FACULTY_DB_VERSION,
    openDatabase: openFacultyDatabase,
    get: getFacultyRecord,
    getAll: getAllFacultyRecords,
    add: addFacultyRecord,
    update: updateFacultyRecord,
    delete: deleteFacultyRecord,
    clear: clearFacultyStore,
    saveFile: saveFacultyFile,
    getFile: getFacultyFile,
    deleteFile: deleteFacultyFile,
    saveMetadata: saveFacultyMetadata,
    getMetadata: getFacultyMetadata,
    deleteMetadata: deleteFacultyMetadata
});
