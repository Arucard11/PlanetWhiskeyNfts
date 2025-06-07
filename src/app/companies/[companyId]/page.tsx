                    <h1 className="text-4xl sm:text-5xl font-bold mb-3 text-brand-text-primary cool-gradient-text">{pageTitle}</h1>
                    {companyName && 
                        <p className="text-lg font-sans text-brand-text-secondary max-w-xl mx-auto">
                            Browse the unique NFT offerings from {companyName}.
                        </p>
                    }
                    {/* Remove or conditionally render the Company ID display
                    {!companyName && companyId && 
                        <p className="text-sm font-sans text-brand-text-secondary">
                            Company ID: {companyId}
                        </p>
                    }
                    */}
                    {mintMessage && (
                         <p className={`mt-4 text-sm font-sans px-4 py-2 rounded-md inline-block 